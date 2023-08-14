---
layout: '../../layouts/Post.astro'
title: How to perf
image: /images/web-design
publishedAt: 2022-09-03
category: 'PMU'
---
Linux perf is a very powerful performance analysis tool. It consists of two parts:

1. [Userspace Binary](#userspace-binary)
2. [Kernel API's](#kernel-apis)

It is build around events which you can list with `perf list`. There are hardware (cycles, L1 cache misses, etc.) and software events (branches, faults, etc.). These events can be sampled in various ways:
1. `perf record -F 99 sleep 4`: Collects samples on `perf_event`'s which get approximately capped at 99 samples a second (could be more or less depending on c-state of the cpus)
2. `perf record -e '{cycles,cache-misses}:S' sleep 4`: Collects samples on the event group leader `cycles`

## Userspace Binary
There are two main ways to use the userspace binary:

1. [perf stat](#perf-stat)
2. [perf record](#perf-record)

### perf stat
`perf stat` runs perf in a counting mode with minimal active overhead. It simply aggregates events and outputs sums at a fixed interval
```bash
hilldani@hilldani-mobl:~$ sudo perf stat -I 5000 -e cycles,instructions
#           time             counts unit events
     5.010436323         1359010193      cycles
     5.010436323         1040197178      instructions              #    0.77  insn per cycle
    10.029055772          462597075      cycles
    10.029055772          283970127      instructions              #    0.61  insn per cycle
    15.047830993         1326929294      cycles
    15.047830993         1054771130      instructions              #    0.79  insn per cycle
    15.639174290           17915015      cycles
    15.639174290            5086827      instructions              #    0.28  insn per cycle
```

### perf record
`perf record` actively collects context for every sample and does not aggregate. It then has to be postprocessed by `perf script`.

```bash
hilldani@hilldani-mobl:~$ sudo perf record -F 99 -ag -e cycles sleep 4
[ perf record: Woken up 1 times to write data ]
[ perf record: Captured and wrote 0.303 MB perf.data (289 samples) ]
hilldani@hilldani-mobl:~$ sudo perf script
perf 128927 [000] 23729.724910:          1 cycles:
        ffffffff8100ab03 __intel_pmu_enable_all.constprop.0+0x43 ([kernel.kallsyms])
        ffffffff8124f282 event_function+0x82 ([kernel.kallsyms])
        ffffffff8124971f remote_function+0x3f ([kernel.kallsyms])
        ffffffff8119b23c generic_exec_single+0x4c ([kernel.kallsyms])
        ffffffff8119b34b smp_call_function_single+0xdb ([kernel.kallsyms])
        ffffffff8124fb74 event_function_call+0x114 ([kernel.kallsyms])
        ffffffff81248952 perf_event_for_each_child+0x32 ([kernel.kallsyms])
        ffffffff8125712b _perf_ioctl+0x20b ([kernel.kallsyms])
        ffffffff8125789d perf_ioctl+0x3d ([kernel.kallsyms])
        ffffffff81324838 __x64_sys_ioctl+0x88 ([kernel.kallsyms])
        ffffffff81ed9e38 do_syscall_64+0x38 ([kernel.kallsyms])
        ffffffff82000099 entry_SYSCALL_64_after_hwframe+0x61 ([kernel.kallsyms])
            7f749433a3ab ruserok_af+0x4b (/usr/lib/x86_64-linux-gnu/libc-2.31.so)
            559ffa7f472a __evlist__enable+0x1ea (/usr/local/bin/perf)
            559ffa760f1e cmd_record+0x212e (/usr/local/bin/perf)
            559ffa7de453 run_builtin+0x73 (/usr/local/bin/perf)
            559ffa74723c main+0x67c (/usr/local/bin/perf)
            7f749424a083 putenv+0xf3 (/usr/lib/x86_64-linux-gnu/libc-2.31.so)

```

Raw perf script output can be processed by whatever program you want. Here it shows the first sample from cpu 0 had only 1 cycles (it just started), and was running perf at the time of the sample. Below we get a call stack of what function we were in inside of perf at that moment

## Kernel API's
The perf binary is simply a wrapper around perf syscalls into the linux kernel.
```c
fd = syscall(__NR_perf_event_open, ...);
```