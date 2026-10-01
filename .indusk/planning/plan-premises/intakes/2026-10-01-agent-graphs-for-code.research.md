---
title: "Research run — agent graphs for software development"
date: 2026-10-01
kind: intake-research
follows: 2026-10-01-multiagent-and-graph-engineering.md
---

# Multi-agent role graphs vs. single agents for software development: the evidence as of 2026-10-01

**Short answer (moderate confidence):** No controlled, peer-reviewed evidence shows role-graph architectures beating a strong single agent on realistic coding benchmarks. The most controlled measurement we found shows a small loss on SWE-bench Verified. Multi-agent setups gain where the work splits into independent pieces, and where an extra agent reviews or verifies but does not co-write. Both labs and practitioners have converged on the same pattern: one agent writes, and extra agents add intelligence (review, investigation, consultation).

## 1. Measured results

**Controlled comparison (preprint; not verified as peer-reviewed).** Kim et al. (Google Research and others), "Towards a Science of Scaling Agent Systems", arXiv 2512.08296 (v1 Dec 9 2025, v3 Apr 8 2026). It tested 260 configurations across six benchmarks, one of which is SWE-bench Verified.
- On SWE-bench Verified: *"all MAS architectures show slight degradation relative to SAS (mean 0.522): Hybrid −2.1%, Centralized −3.1%, Decentralized −5.4%, and Independent −14.9%"* (MAS = multi-agent system, SAS = single-agent system).
- Across all six benchmarks: *"Relative performance change compared to single-agent baseline ranges from +80.8% on decomposable financial reasoning to −70.0% on sequential planning."*
- Proposed threshold: *"tasks where single-agent performance already exceeds 45% accuracy experience negative returns from additional agents."*

**Failure taxonomy (preprint).** Cemri et al., "Why Do Multi-Agent LLM Systems Fail?" (MAST), arXiv 2503.13657 (v3 Oct 2025). It annotated 1,600+ traces across 7 frameworks, including ChatDev and MetaGPT, and found 14 failure modes in three groups: system design, inter-agent misalignment and task verification. It also says *"performance gains on popular benchmarks are often minimal."* I did not confirm a peer-reviewed venue. Secondary sources quote further figures (41–86.7% failure rates; ChatDev at 33.33% on ProgramDev; MetaGPT's standard operating procedures cutting some failure types by 60–68%), but I did not check those against the paper.

**Benchmark of feature development (preprint).** SWE-Dev, arXiv 2505.16975:
- *"Most MAS methods outperform the single agent, and simpler general MASs are more effective and efficient than complex coding-specific MASs."*
- *"Systems with manually defined roles and interaction protocols…tend to be less effective. On hard tasks, ChatDev requires over 30 calls yet only achieves 11.7%."*
- Its "single agent" baseline is a plain model call, not a tool-using agent. That weakens what the comparison tells us about agent graphs.

**SWE-bench leaderboard study (peer-reviewed, ICSE-SEIP 2026).** "Dissecting the SWE-Bench Leaderboards", arXiv 2506.17208, profiled 80 approaches. Its abstract reports both agentic and non-agentic designs and does not name a winning architecture. A secondary summary attributes to it the line "cannot determine that one architecture achieves better results than the other"; I did not verify that sentence in the paper.

**Peer-reviewed counterpoint on complexity.** Agentless (Xia et al., FSE 2025) is a fixed three-step pipeline with no agent at all. It reached 32.67% on SWE-bench Lite at about $0.68 per issue, the best of the open-source agents at the time.

**The original role-graph papers (peer-reviewed).**
- MetaGPT was an ICLR 2024 oral; ChatDev was ACL 2024.
- Both compared against single-model baselines that critics say were understated. GitHub issue #418 on MetaGPT argues gpt-4-0613 scores 86.59% on HumanEval, against the roughly 67% the paper reported. I saw no maintainer rebuttal; the issue is closed.
- These are 2023–24 results on HumanEval and toy apps, not SWE-bench.

## 2. Named systems: claims vs. independent evidence

- **MetaGPT / ChatDev** (role pipelines that follow standard operating procedures)
  - Claim: role specialization improves output.
  - Independent evidence: MAST and SWE-Dev both find heavy role protocols cost more and are often less effective than simpler setups.
- **AgentCoder** (programmer, test-designer and test-executor agents; arXiv 2312.13010)
  - Self-reported: 96.3% pass@1 on HumanEval; the test-designer agent writes correct tests 89.6% of the time with GPT-4.
  - Venue not verified, and HumanEval is saturated.
- **Claude Code agent teams** (vendor docs; experimental, off by default)
  - The docs say: *"For sequential tasks, same-file edits, or work with many dependencies, a single session or subagents are more effective,"* and *"Two teammates editing the same file leads to overwrites."*
  - No benchmark is published.
- **Devin / Devin Review** (Cognition)
  - Vendor claim, no independent check found: the review agent *"catches an average of 2 bugs per PR, of which roughly 58% are severe."*
- **Factory, OpenAI Codex, Google offerings, LangGraph-based coding agents:** I did not fetch primary sources for these, so I make no claims about them.

## 3. Positions on both sides (opinion or vendor experience, not controlled measurement)

**Anthropic, "How we built our multi-agent research system" (Jun 13 2025)**
- Internal eval, research tasks only: the multi-agent version *"outperformed single-agent Claude Opus 4 by 90.2%"*.
- Cost: *"multi-agent systems use about 15× more tokens than chats."*
- On coding: *"most coding tasks involve fewer truly parallelizable tasks than research, and LLM agents are not yet great at coordinating and delegating to other agents in real time."*

**Cognition, "Don't Build Multi-Agents" (Jun 12 2025)**
- Principles: *"Share context, and share full agent traces, not just individual messages"* and *"Actions carry implicit decisions, and conflicting decisions carry bad results."*
- On Claude Code's subagents: *"it never does work in parallel with the subtask agent."*

**Cognition, "Multi-Agents: What's Actually Working" (Apr 22 2026)** narrows rather than reverses that position: *"multi-agent systems work best today when writes stay single-threaded and the additional agents contribute intelligence rather than actions."* It reports that reviewers do better with clean context than with shared context.

**Anthropic Frontier Red Team, "Patterns and problems in emerging multiagent systems" (Aug 13 2026).** These are experiments, not a peer-reviewed benchmark.
- Vulnerability hunting: a coordinated swarm (45 agents, a shared forum, peer review, and an arbiter agent making final decisions) found *"266 vulnerabilities over a 27 million token run"*. Independent parallel agents found *"21 vulnerabilities over a 6.5 million token run"*, with *"only 12 vulnerabilities in common."*
- Shared-codebase game build:
  - Sonnet 4.6 and Opus 4.6 *"opened 876 and 980 PRs but closed few"*.
  - *"Only Sonnet 5 is able to maintain both a high merge fraction while directly collaborating"*; other models reached high merge rates only by avoiding shared files.
  - The "Only Sonnet 5…" line comes from the LessWrong linkpost of the article, not the Anthropic page itself.
- Closing line: *"The conditions that allow multiagent interaction to go well will be discovered one way or another: either deliberately and early, or—and by default—in production, after agents' interactions far outnumber ours."*

**"Graph Engineering in the Era of LLM Agents" (arXiv 2608.21156, Aug 21 2026).** A survey, not an empirical study, and it makes no software-engineering-specific claims I could find. Its position: *"intelligence must instead be distributed across specialized agents and organized at the system level."* It is an argument from organization, not evidence.

## 4. Where agent graphs help and hurt, for code

| Helps (evidence) | Hurts (evidence) |
|---|---|
| Parallel exploration and search: the vulnerability swarm; the Scaling paper's gains on decomposable tasks | Sequential, interdependent work: up to −70% in the Scaling paper; −2% to −15% on SWE-bench Verified |
| Review or verification by a separate agent with clean context (Cognition, vendor) | Several writers on shared files: overwrites (Claude Code docs); PRs left open (Anthropic 2026) |
| Independent modules with disjoint file ownership (C compiler, docs) | Heavy role protocols (ChatDev): more calls, lower success (SWE-Dev) |
| Containing errors: centralized coordination amplifies errors 4.4×, independent agents 17.2× (Scaling paper) | Token cost: about 15× chat (Anthropic 2025); agent teams scale linearly per teammate |

## 5. Structural verification inside multi-agent coding

- **Anthropic C compiler (Feb 5 2026; vendor case study).** 16 parallel agents, about 2,000 sessions, about $20k, a 100k-line compiler.
  - *"it's important that the task verifier is nearly perfect, otherwise Claude will solve the wrong problem."*
  - Parallelism came from git, lock files that let agents claim tasks, and CI.
  - When the Linux kernel build became one big shared task, *"every agent would hit the same bug, fix that bug, and then overwrite each other's changes."* Using GCC as a reference compiler split that task so agents could work on different files.
- **Claude Code agent teams** ship gate hooks (`TaskCompleted` and `TeammateIdle`, where exit code 2 blocks the step). No effectiveness data is published.
- **MAST** lists verification as one of its three failure groups. ChatDev's explicit test and review phases reduced verification failures.
- **SWE-Gate (arXiv 2609.04167, Sep 2026; single agents only):** *"among 644 repairs that pass the functional tests, 221 fail to satisfy the provided review constraints."* Test gates alone overstate acceptability.
- **AgentCoder:** a separate test-designer agent improves test accuracy (self-reported, on HumanEval).

**Gap:** I found no controlled study isolating whether enforced gates or test-first workflows are what make multi-agent coding work. The evidence is case studies and vendor features.

## Sources
- https://arxiv.org/abs/2512.08296 , https://arxiv.org/html/2512.08296v3
- https://arxiv.org/abs/2503.13657
- https://arxiv.org/html/2505.16975v2
- https://arxiv.org/abs/2506.17208
- https://conf.researchr.org/details/fse-2025/fse-2025-research-papers/85/Demystifying-LLM-based-Software-Engineering-Agents
- https://iclr.cc/virtual/2024/oral/19756 ; https://aclanthology.org/2024.acl-long.810/
- https://github.com/geekan/MetaGPT/issues/418
- https://arxiv.org/pdf/2312.13010
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://cognition.com/blog/dont-build-multi-agents
- https://cognition.com/blog/multi-agents-working
- https://www.anthropic.com/research/multiagent-systems ; https://www.lesswrong.com/posts/iQiDPmAgKo4KcG5uy/patterns-and-problems-in-emerging-multiagent-systems
- https://arxiv.org/abs/2608.21156
- https://www.anthropic.com/engineering/building-c-compiler
- https://code.claude.com/docs/en/agent-teams
- https://arxiv.org/abs/2609.04167