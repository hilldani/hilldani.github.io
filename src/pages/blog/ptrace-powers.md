---
layout: '../../layouts/Post.astro'
title: ptrace power
image: /images/code
publishedAt: "2023-09-26"
category: 'instrumentation'
---
ptrace is an ancient syscall built into the linux kernel. It is a bit of a magic wand. Through different parameters you can control other processes (memory, assembly, instruction pointer etc.). As an example of is power I am going to show you how to get an instruction mix of your entire system.

```python
debugger = PtraceDebugger()
process = debugger.addProcess(p.pid, is_attached=False)
process.cont()
```
Here I am using [python-ptrace](https://github.com/vstinner/python-ptrace) to interface with ptrace from python without needing to load ctypes. First you make the current process a "tracer" of the target "tracee" process (pid). This interrupts the tracee so you'll need to signal that it should continue execution
```python
os.kill(p["process"].pid, signal.SIGTRAP)
event = p["debugger"].waitProcessEvent()
eip = p["process"].getInstrPointer()
insn = p["process"].readBytes(eip, 15)
p["process"].cont()
```
In order to sample the current assembly being executed ptrace needs to regain control of the process. This can happen when the tracee receive a signal like SIGTRAP which inserts an `int3` instruction like a breakpoint. Then the tracee stops and we can read the current instruction pointer. Once we have the current instruction pointer we can read that address in the processes virtual memory space using ptrace as well. Most modern x84 linux machines will have 15 bytes per instruction. Then we return the process to its normal execution.
```python
formatter = Formatter(FormatterSyntax.NASM)
insnraw = formatter.format(Decoder(64, insn).decode())
```
Here I use [iced](https://github.com/icedland/iced) to decode each hexcode instruction into NASM format.
```
...
mov esi,eax
call 0FFFFFFFFFFFFFFE7h
push rbx
endbr64
fstp tword [rsp-68h]
fldz
faddp
fdivrp
unpckhpd xmm0,xmm0
subpd xmm1,xmm4
...
```
Now we can start to see the raw assembly that any process in linux is executing. We can tweak the sampling frequency to reduce the overhead as needed. What I'm interested in here though is use of modern instructions using the expanded matrix registers:

1. xmm = AVX128
2. ymm = AVX256
3. zmm = AVX512

These can greatly increase the speed of cryptography and AI matrix multiplications, but often it is hard to tell if you are using them. Thankfully, at the end of this trace we see `unpckhpd xmm0,xmm0` which means we are successfully using AVX128.