---
layout: '../../layouts/Post.astro'
title: How to scale up
image: /images/scale-up
publishedAt: 2024-11-29
category: 'Performance'
---

As any software service grows it often needs to scale up and scale out.

1. Scaling up is running on larger server with more cores.
1. Scaling out is running a program across more servers.

Some software makes the conscious decision to not scale up and only scale out. A great example of this is [Redis](https://github.com/redis/redis) which made the conscious decision to be single threaded so it does not need to worry about locking or race conditions. Other programs are built with scale up in mind. A common architecture for this is the [Share Nothing Architecture](https://www.scylladb.com/glossary/shared-nothing-architecture/). Scylladb is a good example of this because it shards data across each physical core so you never have two different threads accessing the same data.

Most software lands somewhere in the middle and struggles scaling up. To evaluate why your program's performance is not scaling linearly as you add more cores you should look at the following:

1. [perf c2c](https://man7.org/linux/man-pages/man1/perf-c2c.1.html) finds shared memory which can become contested if multiple cores and threads are trying to read it simultaneously. This requires metal vm's in AWS. For x86 it uses offcore PMU registers. For ARM it needs a newer linux perf binary (which can be built from source) so it can use [SPE](https://developer.arm.com/documentation/101136/22-1-3/MAP/Arm-Statistical-Profiling-Extension--SPE-) (Statistical Profiling Extension) which cannot give offcore information like HITM or remote DRAM % but can calculate latency of memory accesses which directly correlates to highly contended memory.
1. [offcputime](https://github.com/iovisor/bcc/blob/master/tools/offcputime.py) finds locks which can cause threads to idle as they wait for the lock to be released. It uses eBPF so it only works on kernels compiled with eBPF enabled.