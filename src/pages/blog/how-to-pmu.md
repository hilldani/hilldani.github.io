---
layout: '../../layouts/Post.astro'
title: How to PMU
image: /images/freelance
publishedAt: "2023-02-05"
category: 'PMU'
---
PMU (performance monitoring unit) is a piece of hardware on most modern cpus. There is one that sits next to each physical core on the CPU. It usually contains a set of fixed registers which can only collect one event, and general purpose registers which can be programed to increment on any hardware event.

<video autoplay loop muted>
  <source src="/videos/pmu.webm" type="video/webm">
</video>

Here you can see how `perf stat -e {cycles,cycles,cycles,cycles,cycles,cycles} sleep 3` would get scheduled on the PMU. When there are more events than registers available it automatically starts multiplexing between the groups and scheduling them. If a group of events cannot be scheduled together it will give `<not counted>` errors.