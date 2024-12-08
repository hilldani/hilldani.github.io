---
layout: '../../layouts/Post.astro'
title: Binary layout
image: /images/chip
publishedAt: 2024-08-18
category: 'Performance'
---

What does it mean to be frontend bound?

By answering this question I sped up a c++ program by 40% without changing a single line of code. Frontend and Backend can refer to portions of the cpu instruction pipeline. Frontend is everything that loads instructions into the execution units. Backend is execution, writeback and retiring of those instructions.

<img src="https://github.com/user-attachments/assets/7b6efa24-ec5b-44a2-b5e8-0b2fc441d164" type="image/webp" loading="eager" class="post-content__img">

When profiling a program you should always see whether the PMU's say it is frontend or backend bound. In this case the program was 60% frontend bound, which for a c++ program is very bad. Usually interpreted languages like Python or Java are frontend bound because their layout is changing as it runs and the CPU cannot easily remember what happened on previous executions of the same code. For static binaries like c++ the cpu should be able to remember.

Immediately I tried to figure out why the CPU was struggling to feed instructions into its execution units. The Speculative CPI was much higher than Architectural CPI. Many of the instructions which were being fetched ended up being discarded. Sure enough it had a 13% branch miss rate, 23% i-cache miss rate, and 21% TLB miss rate. This meant that the CPU branch predictor was struggling and the TLB couldn't fit the hot code into cache easily. I ran linux perf and mapped the instruction addresses sampled directly to the binary.

<img src="https://github.com/user-attachments/assets/e6378281-590a-4834-9508-2a9217dbe05a" type="image/webp" loading="eager" class="post-content__img">

As you can see the hot functions are very spread out across the binary. When compiling, the linker script has no information on which functions will be used so it naively organizes them. However you can group functions with the linker script if you give each function a section and sort the sections with

```bash
-Wl,--symbol-ordering-file=<filename>.orderfile -Wl,--no-warn-symbol-ordering
```

With all the hot path functions next to each other throughput increases by 40% and the new binary shows up like this:

<img src="https://github.com/user-attachments/assets/ccf2d4ad-d3b5-4ce1-8baa-ad9cab73ef84" type="image/webp" loading="eager" class="post-content__img">

Why does this make it so much faster? When code is more compact the CPU has an easier time paging in all the important functions at once. Also this reduces load on the TLB which has to map virtual addresses to the binary functions. When loading in code, the prefetcher also naturally guesses nearby code will be executed and finds it already in the i-cache because it was paged in already. All of these little things add up to letting the instructions flow more freely through the pipeline.