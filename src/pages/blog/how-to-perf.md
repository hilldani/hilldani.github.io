---
layout: '../../layouts/Post.astro'
title: How to perf
image: /images/web-design
publishedAt: 2022-09-03
category: 'PMU'
---

# How to perf

Linux perf is a very powerful tool. It consists of two parts:

1. [Kernel API's](#kernel-apis)
2. [Userspace Binary](#userspace-binary)

## Userspace Binary
There are two main ways to use the userspace binary:

1. `perf stat`
2. `perf record`

### perf stat


```bash
sudo perf record 
```

## Kernel API's
