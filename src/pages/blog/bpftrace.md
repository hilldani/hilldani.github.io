---
layout: "../../layouts/Post.astro"
title: bpftrace super powers
image: /images/ebpf
publishedAt: 2024-12-14
category: "instrumentation"
---

[bpftrace](https://github.com/bpftrace/bpftrace) is a high-level tracing language for Linux. Sometimes you want to profile something very specific, there is no tool for it, and you don't want to write something complex. A quick bpftrace one-liner can save the day.

```bash
bpftrace -e 'uprobe:/lib64/libc.so.6:pthread_mutex_lock* { @start[tid] = nsecs; @stacks[tid] = ustack; } uretprobe:/lib64/libc.so.6:pthread_mutex_lock* /@start[tid]/ { @[@stacks[tid]] = stats(nsecs - @start[tid]); delete(@start[tid]); delete(@stacks[tid]); }'
```

What is happening in this example?

```
uprobe:/lib64/libc.so.6:pthread_mutex_lock*
uretprobe:/lib64/libc.so.6:pthread_mutex_lock*
```

Two probes are getting placed. One at the start, and one at return of pthread_mutex_lock

```
{
    @start[tid] = nsecs;
    @stacks[tid] = ustack;
}
```

A hash maps the current task ID to current nanoseconds and samples the user stack. I have found from experience that uretprobes don't always give accurate stack samples so we have to collect the stack at the start of the function.

```
/@start[tid]/
```

At return it filters for userspace locks which it has recorded a start time for

```
{
    @[@stacks[tid]] = stats(nsecs - @start[tid]);
    delete(@start[tid]);
    delete(@stacks[tid]);
}
```

Now that it has a lock with a recorded start time, it calculates count, total, and average for the current user stack. Then it frees up the data

This is one example of a quick hacky way to measure lock contention at different places in software. It can then be converted into a flamegraph for the most contented locks. Keep in mind that uprobes can add ~1k ns of overhead.
