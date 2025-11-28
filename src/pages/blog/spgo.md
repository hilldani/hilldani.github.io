---
layout: "../../layouts/Post.astro"
title: "Semantic PGO: AI-Driven Auto-Optimization"
image: /images/ai-flame
publishedAt: "2025-11-28"
category: "Performance"
---
Profile-Guided Optimization (PGO) is a powerful technique where the compiler uses data from a running program to make better decisions about inlining and branch prediction. However, traditional PGO is limited to the **syntax** of the binary. It can reorder instructions, but it can't rewrite an `O(n^2)` algorithm into `O(n)`.

That requires a human engineer to look at a flamegraph, identify the bottleneck, and rewrite the code.

But what if we could automate the "human" part?

By combining system profiling with Large Language Models (LLMs), we can create **Semantic PGO**: an optimization loop that doesn't just tune flags, but actually rewrites source code based on runtime behavior.

## The Profiling Part

To fix performance, you first have to find the fire. We can't ask an LLM to "optimize this project" because the context window is too small and the distraction is too high. We need to feed it *only* the code that matters.

I wrote a Python orchestrator that wraps the compilation and execution process. It utilizes system tools (like `sample` on macOS or `perf` on Linux) to grab the stack traces of the running binary.

We parse the folded stack output to calculate which function is consuming the most CPU cycles:

```python
def get_hot_functions():
    """Profile the running binary and return a list of (func_name, samples) sorted by heat."""
    proc = subprocess.Popen([BIN, "42"])
    pid = proc.pid
    
    # Capture stack traces for a set duration
    subprocess.run(["sudo", "sample", str(pid), "10", "-file", SAMPLE_FILE], check=True)
    proc.wait()

    # Collapse stacks and find the most frequent function
    subprocess.run(
        [os.path.join(FLAMEGRAPH_DIR, "stackcollapse-sample.awk"), SAMPLE_FILE],
        stdout=open(FOLDED_FILE, "w"),
        check=True,
    )

    # ... parsing logic returns sorted_funcs ...
    return [f for f, _ in sorted_funcs]
```

This gives us a targeted list of functions that are actual bottlenecks, removing the guesswork.

## The AI Part

Once we have the target (the "hot" function), we need an agent to act on it. For this, I used [Aider](https://aider.chat/), a command-line AI coding assistant, coupled with a local LLM via [Ollama](https://ollama.com/) (specifically `codegemma:7b`).

The script isolates the hot function and sends a specific prompt to the LLM to rewrite it in place. The prompt is crucial—it emphasizes safety and functional equivalence while requesting performance gains.

```python
def optimize_with_aider(func_name):
    """Use aider + Ollama to optimize the function in place."""
    prompt = (
        f"Optimize the function `{func_name}` in this file for performance, "
        f"keeping it functionally equivalent and safe. Edit in place only, "
        f"do not create a new file."
    )

    # Run Aider against the source file
    result = run_cmd([
        "aider",
        "--model", f"ollama/{MODEL}",
        "--edit-format", "whole",
        "--no-auto-commit",
        C_FILE,
        "--message", prompt,
    ], env=env)
```

By using `aider`, we treat the LLM as a developer making a specific patch to the source code, rather than just a text generator.

## The Feedback Loop

The most dangerous part of auto-optimization is regression—making code slower or breaking it entirely. To solve this, the script implements a strict "test and revert" loop:

1.  **Baseline:** Compile and measure wall-time execution.
2.  **Identify:** Find the hottest function.
3.  **Optimize:** Let the AI rewrite that function.
4.  **Verify:** Recompile and Measure.
5.  **Decision:**
      * If **faster**: Keep the change.
      * If **slower** or **broken**: Revert to the backup immediately.

<!-- end list -->

```python
        print("⚡ Measuring new runtime...")
        try:
            new_runtime = measure_runtime()
        except RuntimeError:
            print(f"❌ Program failed to run. Reverting...")
            shutil.copyfile(backup_file, C_FILE)
            continue

        improvement = baseline - new_runtime
        if improvement > 0:
            pct = 100 * improvement / baseline
            print(f"✅ Performance improved by {improvement:.3f}s ({pct:.1f}%)!")
            return
        else:
            print(f"❌ No improvement. Reverting...")
            shutil.copyfile(backup_file, C_FILE)
```

## Results

This setup allows for a completely hands-off optimization loop. You can point the script at a C file, and watch as it iteratively profiles, rewrites, and benchmarks itself.

```bash
🏗️ Building baseline...
🔧 Running: gcc -O2 matrix_stress.c -o matrix_stress
⏱️ Baseline runtime: 22.450s

🔥 Finding hot functions...
🔥 Profiling process PID 12345...
Multiplying 1800x1800 matrices...
Done in 22.61 seconds.
Checksum: 810000.4321
🔥 Hot functions (by sample count): ['main']

🚀 Attempting optimization on hottest function: main
🔧 Running: aider --model openai/gpt-oss-20b-medium-think --edit-format whole --no-auto-commit --no-git matrix_stress.c --message Optimize the function `main` in this file for performance...
Aider: Thought process...
The user wants to optimize the matrix multiplication loop in `main`.
The current implementation has poor cache locality because `B[k][j]` is accessed column-wise.
I will perform loop interchange (changing i-j-k to i-k-j) to access memory sequentially.
I will also perform some loop unrolling.

Applied edits to matrix_stress.c:
<<<<
    // Use vectorization and SIMD instructions
    for (int i = 0; i < SIZE; i++) {
        for (int j = 0; j < SIZE; j++) {
            double sum = 0.0;
            for (int k = 0; k < SIZE; k++) {
                sum += A[i][k] * B[k][j];
            }
            C[i][j] = sum;
        }
    }
====
    // Optimized: Loop Interchange (i-k-j) for better cache locality
    // Initialize C to 0
    for (int i = 0; i < SIZE; i++) {
        for (int j = 0; j < SIZE; j++) {
            C[i][j] = 0.0;
        }
    }

    // Compute
    for (int i = 0; i < SIZE; i++) {
        for (int k = 0; k < SIZE; k++) {
            double r = A[i][k];
            for (int j = 0; j < SIZE; j++) {
                C[i][j] += r * B[k][j];
            }
        }
    }
>>>>

🏗️ Rebuilding optimized version...
🔧 Running: gcc -O2 matrix_stress.c -o matrix_stress

⚡ Measuring new runtime...
⏱️ New runtime: 3.120s
✅ Performance improved by 19.330s (86.1%)!
🏁 Optimization successful. Stopping further attempts.
```

In my tests using `codegemma:7b`, the system successfully identified inefficient loops in a sample C program and replaced them with more efficient memory access patterns, resulting in a measurable performance boost without any human intervention.

This approach bridges the gap between static compiler optimizations and human refactoring.
