---
layout: '../../layouts/Post.astro'
title: How to eBPF
image: /images/photography
publishedAt: 2023-04-10
category: 'eBPF'
---
eBPF (extended Berkeley Packet filter) is a sandboxed runtime inside of the linux kernel. Here are some key open source repos that should be contributed to:

1. https://github.com/iovisor/bcc
2. https://github.com/iovisor/bpftrace
3. https://github.com/libbpf/libbpf

This lets us safely run programs in kernel space without causing panics or needing drivers. Then we can access kernel level information like tcp packets without having to go through the whole stack (see below). There's a few main ways to run eBPF

1. CORE (compile once run everywhere) eBPF programs are written in c and as their name indicates can be compiled once and run everywhere
2. Higher level language (like python) program wrapping some eBPF functions which you attach to various kernel functions

```c
SEC("kprobe/tcp_sendmsg")
int BPF_KPROBE(tcp_sendmsg, struct sock *sk, struct msghdr *msg, size_t size)
{
	u16 family;
	bpf_probe_read_kernel(&family, sizeof(sk->__sk_common.skc_family), &sk->__sk_common.skc_family);
	return 0;
}
```
In this example we are instrumenting the tcp_sendmsg function inside of the linux kernel. Now every time any program sends a message through TCP our function gets called with all the parameters. Now we can read values like remote IP and port or even the messages (although it will be encryped if using TLS)