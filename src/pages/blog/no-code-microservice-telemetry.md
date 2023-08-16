---
layout: '../../layouts/Post.astro'
title: No-code Microservice Telemetry
image: /images/network
publishedAt: "2023-02-05"
category: 'eBPF'
---
Microservices can be one of the most complex and convoluted architectures to wrap your head around. In a monolith you know exactly what is calling what and when, but in microservices a simple API request can traverse a multitude of services before returning. This makes it especially difficult to diagnose performance issues. 

Optimizing one hot service can miss the forest for the trees.

[Open Telemetry](https://opentelemetry.io/) and service meshes like [Istio](https://istio.io/) can help you visualize the connections but these both require code changes. Is this necessary?

## The eBPF Part

Thanks to eBPF we can instrument the TCP stack. See [tcptop.bpf.c](https://github.com/iovisor/bcc/blob/master/libbpf-tools/tcptop.bpf.c) by Francis Laniel. We can modify this code to collect the following for every TCP packet:

1. bytes sent
2. bytes received
3. associated PID (not 100% accurate due to skid but we'll come back to this later)
4. source IP and port
5. destination IP and port


```c
#include <vmlinux.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_core_read.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_endian.h>

/* Define here, because there are conflicts with include files */
#define AF_INET 2
#define AF_INET6 10

struct id_t
{
	u32 pid;
	char task[TASK_COMM_LEN];
};

struct
{
	__uint(type, BPF_MAP_TYPE_PERF_EVENT_ARRAY);
	__uint(key_size, sizeof(u32));
	__uint(value_size, sizeof(u32));
} events SEC(".maps");

SEC("kprobe/tcp_cleanup_rbuf")
int BPF_KPROBE(tcp_cleanup_rbuf, struct sock *sk, int copied)
{
	struct tcp_sock *ts;
	u32 pid = bpf_get_current_pid_tgid() >> 32;
	u16 family;

	if (copied <= 0)
		return 0;

	bpf_probe_read_kernel(&family, sizeof(sk->__sk_common.skc_family), &sk->__sk_common.skc_family);
	
	
	ts = (struct tcp_sock *)(sk);
	u32 srtt = BPF_CORE_READ(ts, srtt_us) >> 3;

	struct event data = {};
	data.span_us = srtt;
	data.rx_b = (u64)copied;
	data.tx_b = 0;
	data.ts_us = 0;
	data.state = -1;
	// a workaround until data compiles with separate lport/dport
	data.ports = bpf_ntohs(BPF_CORE_READ(sk, __sk_common.skc_dport)) + ((0ULL + BPF_CORE_READ(sk, __sk_common.skc_num)) << 32);
	data.pid = pid;

	if (family == AF_INET)
	{
		data.af = AF_INET;
		bpf_probe_read_kernel(&data.saddr_v4, sizeof(sk->__sk_common.skc_rcv_saddr), &sk->__sk_common.skc_rcv_saddr);
		data.daddr_v4 = BPF_CORE_READ_BITFIELD_PROBED(sk, __sk_common.skc_daddr);
	}
	else if (family == AF_INET6)
	{
		data.af = AF_INET6;
		bpf_probe_read_kernel(&data.saddr_v4, sizeof(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32), sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32);
		bpf_probe_read_kernel(&data.daddr_v4, sizeof(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32), sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32);
	}

	bpf_get_current_comm(&data.task, sizeof(data.task));
	bpf_perf_event_output(ctx, &events, BPF_F_CURRENT_CPU, &data, sizeof(data));

	// else drop
	return 0;
}

SEC("kprobe/tcp_sendmsg")
int BPF_KPROBE(tcp_sendmsg, struct sock *sk, struct msghdr *msg, size_t size)
{
	u32 pid = bpf_get_current_pid_tgid() >> 32;
	u16 family;
	bpf_probe_read_kernel(&family, sizeof(sk->__sk_common.skc_family), &sk->__sk_common.skc_family);

	struct event data = {};
	data.span_us = 0;
	data.rx_b = 0;
	data.tx_b = (u64)size;
	data.ts_us = 0;
	data.state = -2;
	// a workaround until data compiles with separate lport/dport
	data.ports = bpf_ntohs(BPF_CORE_READ(sk, __sk_common.skc_dport)) + ((0ULL + BPF_CORE_READ(sk, __sk_common.skc_num)) << 32);
	data.pid = pid;

	if (family == AF_INET)
	{
		data.af = AF_INET;
		bpf_probe_read_kernel(&data.saddr_v4, sizeof(sk->__sk_common.skc_rcv_saddr), &sk->__sk_common.skc_rcv_saddr);
		data.daddr_v4 = BPF_CORE_READ_BITFIELD_PROBED(sk, __sk_common.skc_daddr);
	}
	else if (family == AF_INET6)
	{
		data.af = AF_INET6;
		bpf_probe_read_kernel(&data.saddr_v4, sizeof(sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32), sk->__sk_common.skc_v6_rcv_saddr.in6_u.u6_addr32);
		bpf_probe_read_kernel(&data.daddr_v4, sizeof(sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32), sk->__sk_common.skc_v6_daddr.in6_u.u6_addr32);
	}

	bpf_get_current_comm(&data.task, sizeof(data.task));
	bpf_perf_event_output(ctx, &events, BPF_F_CURRENT_CPU, &data, sizeof(data));

	// else drop
	return 0;
}

char LICENSE[] SEC("license") = "GPL";
```

## The User Space Part
This gives us a log of every TCP packet sent and received. Now if you collect this log on every system in your cluster you can start to piece together the spiderweb of your microservices workload.

I used [Deno](https://deno.land/) to aggregate and transmit all this data as a quick hack, but this task would scale much better as a Prometheus Grafana setup.

The final visualization was built as a [React](https://react.dev/) web app using [Material UI](https://mui.com/material-ui/) and [Apache Echarts](https://echarts.apache.org/en/index.html) for the chart. I chose Echarts over d3 because it utitlized the canvas element for drawing instead of SVG which can be more performant when there are lots of little pieces.

<picture>
    <img
    class="post-content__img"
    loading="eager"
    src="https://user-images.githubusercontent.com/86739774/206239965-7db96c92-6515-44ae-b063-a6970c762ae9.gif" type="image/gif"
    alt={frontmatter.alt}
    />
</picture>

This is a small k8s cluster with a simple Istio gateway to a set of [nighthawk](https://github.com/envoyproxy/nighthawk) services all through [Envoy](https://github.com/envoyproxy/envoy)

This setup can now be dropped onto any system and instantly visualize all TCP traffic mapped to processes