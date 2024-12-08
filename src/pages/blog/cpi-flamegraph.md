---
layout: '../../layouts/Post.astro'
title: CPI flamegraphs
image: /images/flame
publishedAt: "2023-06-12"
category: 'PMU'
---
Performance engineering is often split into three groups:

1. Software
2. Deployment
3. Hardware

Each group works independently to make a workload as fast as possible. Software folks look at big O complexity. Deployment folks try to pick the best OS's, containers, and geo distributions. Hardware folk try to pick the fastest hardware with the lowest power requirements (classic power in money out machine). Each discipline is valuable angle but has tunnel vision on the complete picture of performance engineering.

Teaching observability as integral to the software process can solve this problem. Take for example the task of JSON processing. Many software developers address this problem from a big O perspect. Just for java alone there is a litany of solutions:
* [avaje-jsonb](https://github.com/avaje/avaje-jsonb)
* [boon](https://github.com/boonproject/boon)
* [dsl-json](https://github.com/ngs-doo/dsl-json)
* [fastjson](https://github.com/alibaba/fastjson)
* [flexjson](http://flexjson.sourceforge.net/)
* [genson](https://owlike.github.io/genson/)
* [gson](https://github.com/google/gson)
* [jackson](https://github.com/FasterXML/jackson)
* [jakarta-json](https://jsonp.java.net/) (from Oracle)
* [johnzon](http://johnzon.apache.org/)
* [json-io](https://github.com/jdereg/json-io)
* [json-simple](https://code.google.com/archive/p/json-simple/)
* [json-smart](http://netplex.github.io/json-smart/)
* [logansquare](https://github.com/bluelinelabs/LoganSquare)
* [minimal-json](https://github.com/ralfstx/minimal-json)
* [mjson](https://github.com/bolerio/mjson)
* [moshi](https://github.com/square/moshi)
* [nanojson](https://github.com/mmastrac/nanojson)
* [org.json](https://github.com/stleary/JSON-java)
* [purejson](https://senthilganeshs.github.io/jsonp/)
* [qson](https://github.com/quarkusio/qson)
* [tapestry](https://tapestry.apache.org/json.html)
* [underscore-java](https://github.com/javadev/underscore-java)

However few software developers see it from a hardware perspective. Recent vectorized instruction sets can perform massive operations in parallel which used to be sequential (see [SIMDJSON](https://github.com/simdjson/simdjson)). Lets try to solve this knowledge gap. Flamegraphs, a visualization made popular by Brendan Gregg, are often used to characterize software.

<picture>
<img src="https://user-images.githubusercontent.com/86739774/262723936-c4150c50-2701-49ce-9fc3-f24df7ccdb22.svg" type="image/gif" loading="eager" class="post-content__img">
</picture>

The data for this chart can be collected with the following perf command
```sh
sudo perf record -F 99 -ag sleep 60
```
But this doesn't show any hardware insights. Let's monitor instruction pipeline efficiency on top of this. Now the command looks like:
```sh
sudo perf record -F 99 -ag -e "{cycles,instructions}" sleep 60
```

This samples collapsed stacks, cpu-cycles, and instructions approximately 99 times a second (can be less if the cpu is in a power saving state). Now if we regenerate the graph but color by CPI (cycles per instructions) we can see what parts of our code flow quickly through the CPU and which are less efficient and require more cpu-cycles to complete.

<picture>
<img src="https://user-images.githubusercontent.com/86739774/262725788-3af22cee-c76d-437f-af46-096a8b85d0a9.svg" type="image/gif" loading="eager" class="post-content__img">
</picture>

Originally it looked like the stress-ng processes should be the targets of optimization but now it becomes clear IO is causing major cpu stall inside the Node process. Flamegraphs show where you're CPU spends the most time but don't convey which areas have the highest potential for improvement.