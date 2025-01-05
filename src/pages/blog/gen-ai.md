---
layout: "../../layouts/Post.astro"
title: Building an AI website
image: /images/comic
publishedAt: 2025-01-04
category: "Hobby"
---

Teaching my kids how to read while listening to the wild stories they came up with gave me an idea. What if there was a website that could turn my kids silly stories into short picture books for them to practice reading with. Everything that existed was way too complicated and low quality, so I decided to brush off my fullstack skills and build it.

Try it out at [playground-160.pages.dev](https://playground-160.pages.dev/)

The stack is:
- Frontend
  - [vite](https://vite.dev/)
  - [react](https://react.dev/)
  - [mantine](https://mantine.dev/)
- Backend
  - [node.js](https://nodejs.org/en)
  - [FLUX.1 schnell](https://huggingface.co/black-forest-labs/FLUX.1-schnell)
  - [Llama 3.3 70B instruct](https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct)

I hosted it all in [Cloudflare](https://www.cloudflare.com/) and built with [bun](https://bun.sh/).

## How does it work?
You type in a short story description (below picture was generated from "a short story that leads up to a really good pun"). It sends that story to the story API which proceeds to prompt Llama to generate the needed text. Conversation AI's function by receiving a whole conversation as input with different actors: 'user', 'assistant', 'system' and 'tool'

```
const messages = [
    {
        role: "system",
        content: "You are a cartoon writer who responds in 6 frame comic descriptions",
    },
    {
        role: "user",
        content: "a short story that leads up to a really good pun",
    },
];
```

System is usually hints for the chatbot. In this case what I need out of it is:

1. Caption text
2. Frame art description

After generating all of this data, the frame descriptions and captions get sent back to the front end, which can then issue a request to the frame API for each frame in parallel (because gen AI is slow despite picking fast models). This API processes the descriptions with Flux.1 schnell and sends back the generated frame. Finally it is all assembled in the front end.

<img src="/images/comic.webp" type="image/webp" class="post-content__img">
