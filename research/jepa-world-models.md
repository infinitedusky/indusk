# JEPA and World Models: Research Summary

**Date**: 2026-03-27
**Purpose**: Exploratory research into Joint Embedding Predictive Architecture (JEPA) and its connection to world models, agent architectures, and representation-based reasoning.

---

## 1. What is JEPA?

Joint Embedding Predictive Architecture (JEPA) is a self-supervised learning framework proposed by Yann LeCun that learns by **predicting representations, not raw data**. This is the core distinction that separates it from every other major paradigm.

### The Key Insight: Predict in Representation Space

Given two related inputs x and y (e.g., two views of an image, consecutive video frames), JEPA:

1. Encodes x into a representation s_x via a **context encoder**
2. Encodes y into a representation s_y via a **target encoder**
3. Trains a **predictor** to map s_x to a predicted s_y
4. The loss is the distance between the predicted and actual target representations

The critical difference: the predictor never reconstructs pixels, tokens, or any raw signal. It operates entirely in abstract representation space.

### Why This Matters

**Generative models** (GANs, diffusion models, autoregressive LLMs) predict raw outputs -- pixels, tokens, waveforms. This forces them to model every detail, including irrelevant noise (grass blade positions, pixel artifacts, exact word choice for semantically equivalent statements). The model wastes capacity on unpredictable low-level variation.

**Contrastive learning** (CLIP, SimCLR) learns by pulling representations of related inputs together and pushing unrelated ones apart. This requires carefully constructed negative examples, and the number of negatives needed scales exponentially with representation dimensionality -- the "curse of dimensionality" for contrastive methods.

**JEPA** sidesteps both problems:
- It doesn't need to predict irrelevant details (unlike generative)
- It doesn't need negative examples (unlike contrastive)
- The representation naturally compresses out unpredictable noise while preserving semantically meaningful structure

Think of it this way: if you see a car driving left, a generative model must predict every pixel of the next frame. JEPA only needs to predict the abstract representation "car continues moving left" -- a vastly simpler and more useful prediction.

### How It Avoids Representation Collapse

The obvious failure mode: the encoders learn to map everything to the same constant representation, making all predictions trivially correct (zero loss). This is called **representation collapse**.

JEPA prevents collapse through:
- **EMA (Exponential Moving Average) target encoder**: The target encoder's weights are a slowly-updated moving average of the context encoder, preventing sudden distribution shifts
- **Architectural constraints**: Limited latent variable dimensionality, careful masking strategies
- **Regularized loss design**: Direct L1/MSE loss on representations rather than contrastive losses
- **Information bottleneck**: The masking/encoding process itself regularizes information flow

This is a major advantage over contrastive methods, which require explicit negative mining infrastructure.

### The Latent Variable z

JEPA introduces an optional latent variable z to handle multimodality -- situations where multiple valid futures exist. The energy function becomes E_w(x, y, z), where minimizing over z yields F_w(x, y) = min_z E_w(x, y, z). This allows the system to represent uncertainty ("the car could turn left or right") without collapsing to a single prediction.

### Connection to Energy-Based Models

JEPA is grounded in **Energy-Based Models (EBMs)**. An energy function F(x, y) assigns low values when x and y are compatible (y plausibly follows x) and high values otherwise. The system learns an energy landscape over the representation space rather than a probability distribution over outputs. This is a more natural framework for modeling compatibility and plausibility than explicit likelihood estimation.

---

## 2. LeCun's Vision: A Path Towards Autonomous Machine Intelligence

LeCun's 2022 position paper (version 0.9.2) outlines a complete architecture for autonomous intelligent agents. JEPA is the centerpiece, but it's embedded in a larger system.

### The Three Fundamental Questions

1. How can machines learn world models to achieve human-like data efficiency?
2. How can machines reason and plan in ways compatible with gradient-based learning?
3. How can machines learn hierarchical representations at multiple abstraction levels and time scales?

### The Six-Module Architecture

```
                    ┌──────────────┐
                    │ Configurator │ (executive control)
                    └──────┬───────┘
                           │ modulates all modules
        ┌──────────┬───────┴───────┬──────────┐
        v          v               v          v
  ┌──────────┐ ┌─────────┐ ┌───────────┐ ┌───────┐
  │Perception│ │  World   │ │   Cost    │ │ Actor │
  │          │ │  Model   │ │ (Critic)  │ │       │
  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └───┬───┘
       │             │             │           │
       v             v             v           v
  ┌──────────────────────────────────────────────┐
  │              Short-Term Memory               │
  └──────────────────────────────────────────────┘
```

**Perception Module**: Estimates the current state of the world from sensory input. Can represent state at multiple levels of abstraction -- stratified representations from low-level features to high-level concepts.

**World Model**: The central component. Predicts future world states given current state and hypothetical actions. This is where JEPA lives. The world model enables the agent to "imagine" consequences without acting, which is the foundation of planning.

**Cost Module (Critic)**: Computes a scalar "discomfort" or "energy" value for world states. Combines:
- **Intrinsic cost**: Hard-wired drives (analogous to pain, hunger, curiosity)
- **Trainable critic**: Learned value function predicting future intrinsic costs

**Actor Module**: Proposes action sequences designed to minimize predicted future cost. In planning mode, it optimizes actions via gradient descent through the differentiable world model.

**Short-Term Memory**: Stores current and predicted world states along with their associated costs. Provides temporal context for decision-making.

**Configurator**: The executive controller -- an "orchestra conductor" that modulates all other modules based on the current task. It can adjust attention, set subgoals, and switch between behavioral modes. This is LeCun's answer to "how does the system know what to focus on."

### Mode 1 vs. Mode 2: Two Systems of Thinking

**Mode 1 (Reactive / System 1)**: Perception directly drives action through a trained policy network. Fast, automatic, no deliberation. Like catching a ball -- you don't plan the trajectory, your trained reflexes handle it.

**Mode 2 (Planning / System 2)**: The full architecture engages:
1. Perception estimates current state
2. Actor proposes candidate action sequences
3. World model predicts resulting future states
4. Cost module evaluates those predicted states
5. Actor refines actions via gradient-based optimization
6. Best action sequence is executed

This is analogous to Model Predictive Control (MPC) in robotics and optimal control theory.

**The critical bridge**: Mode 2 reasoning can be "compiled" into Mode 1 policies. After enough planning experience, the agent trains a reactive policy to approximate Mode 2 decisions. This is how skills are acquired -- deliberate practice becomes automatic expertise. You plan your first few drives, then driving becomes reactive.

### Hierarchical JEPA (H-JEPA)

The architecture becomes truly powerful through hierarchical stacking:

```
H-JEPA Level 3:  [Abstract goal planning]     -- minutes/hours ahead
    |                                            "drive to work"
H-JEPA Level 2:  [Mid-level sub-planning]     -- seconds ahead
    |                                            "change lanes"
H-JEPA Level 1:  [Fine-grained prediction]    -- milliseconds ahead
                                                 "turn wheel 5 degrees"
```

Each level operates at a different time scale and abstraction level:
- **Low levels**: Detailed representations, short-term predictions (immediate motor control)
- **High levels**: Abstract representations, long-term predictions (goal planning)

Higher levels generate subgoals that constrain lower levels. A complex task like "drive to work" decomposes into lane changes, which decompose into steering adjustments. This mirrors human hierarchical planning.

### Why This Can't Be Done with LLMs (LeCun's Argument)

LeCun's core critique of autoregressive LLMs:
- They generate tokens sequentially without lookahead or planning
- They operate in token space, not representation space
- They can't easily backtrack or optimize over future trajectories
- Each token prediction compounds errors (no mechanism to correct the plan)
- They have no intrinsic cost function -- they optimize likelihood, not utility

The world model approach enables true planning: evaluate entire action sequences before committing, optimize trajectories through gradient descent, and reason at multiple abstraction levels simultaneously.

---

## 3. Technical Architecture Details

### The Three Components

**Context Encoder**: A Vision Transformer (ViT) that processes visible/unmasked input patches into representations. Standard transformer architecture with positional embeddings.

**Target Encoder**: Identical architecture to the context encoder but with **EMA-updated weights**. The target encoder's parameters are an exponential moving average of the context encoder's parameters: θ_target = α * θ_target + (1 - α) * θ_context. This provides stable training targets and prevents collapse. The target encoder is NOT trained via backpropagation -- only through the EMA update.

**Predictor**: A smaller transformer that takes the context encoder's output plus positional information about the target region, and predicts what the target encoder's output would be for the masked region. The predictor is the learned "world model" component -- it must understand spatial/temporal relationships to predict representations of unseen regions.

### Training Process (I-JEPA example)

1. Take an image, split into N non-overlapping patches
2. Randomly select target blocks (multiple large contiguous regions)
3. Select a context block (larger region, non-overlapping with targets)
4. Context encoder processes the context patches -> context representations
5. Predictor takes context representations + target position encodings -> predicted target representations
6. Target encoder (EMA) processes the actual target patches -> target representations
7. Loss = L1 distance between predicted and actual target representations
8. Backpropagate through context encoder and predictor only (target encoder updates via EMA)

### Why Multi-Block Masking Matters

The masking strategy is critical. I-JEPA uses **multi-block masking**: multiple large contiguous target regions rather than random scattered patches. This forces the model to learn semantic concepts rather than interpolating from nearby patches. If you mask a small random patch, the model can "cheat" by copying adjacent pixel patterns. If you mask an entire object region, the model must understand what should be there semantically.

---

## 4. I-JEPA and V-JEPA: The Implementations

### I-JEPA (Image JEPA, 2023)

The first concrete implementation of JEPA for images.

**Architecture**: Vision Transformer with 632M parameters.

**Key results**:
- State-of-the-art low-shot classification on ImageNet with only 12 labeled examples per class
- Superior performance on low-level vision tasks (object counting, depth prediction) compared to augmentation-based methods
- Trained on 16 A100 GPUs in under 72 hours -- 2-10x more efficient than competing self-supervised methods
- No hand-crafted data augmentations required (unlike contrastive methods that rely on carefully designed augmentations)

**What it demonstrated**: A "primitive world model" that understands spatial relationships in static images. The predictor learns to model spatial uncertainty -- what could plausibly exist in a masked region given the visible context.

### V-JEPA (Video JEPA, 2024)

Extends JEPA to video -- spatiotemporal prediction.

**Key modifications**:
- Treats video as 3D data (frames x height x width)
- Spatiotemporal patches (16x16 pixels x 2 frames)
- Large spatiotemporal masking regions (blocks across both space and time)
- Temporal masking prevents trivial shortcuts from adjacent frames

**Key results**:
- 1.5x to 6x more training efficient than generative video methods
- Excels at fine-grained action recognition (distinguishing "putting down a pen" from "pretending to put down a pen")
- Frozen evaluation: pre-trained encoder stays fixed, only small task-specific layers are trained
- Outperforms baselines with only 5-50% of labeled training data

**Limitation**: Only handles short clips (a few seconds). Not yet capable of long-horizon temporal reasoning.

### V-JEPA 2 (2025)

A major scaling milestone -- the first world model from video that enables understanding, prediction, AND planning.

**Scale**:
- 1.2 billion parameters (ViT-g/16)
- Pre-trained on 1M+ hours of internet video + 1M images
- 64-frame clips (~16 seconds, up from ~3 seconds in V-JEPA 1)
- Progressive training: short sequences first, then longer

**Results**:
- State-of-the-art on Something-Something v2 (77.3 top-1 accuracy for motion understanding)
- State-of-the-art on Epic-Kitchens-100 (39.7 recall@5 for action anticipation)
- When aligned with LLMs: 84.0 on PerceptionTest, 76.9 on TempCompass for video QA
- **Zero-shot robot control**: Adapted with only 62 hours of unlabeled robot video, then deployed on Franka arms in new labs for pick-and-place tasks (65-80% success rate) with NO task-specific training data

**The planning loop**: V-JEPA 2 imagines action consequences by rolling forward candidate action sequences through its world model, scoring outcomes against visual goals, and executing the best sequence. This is Mode 2 reasoning from LeCun's paper, realized in practice.

### VL-JEPA (Vision-Language JEPA, 2025)

Extends JEPA to multimodal vision-language tasks. Achieves 285% speedup over autoregressive baselines while halving trainable parameters and reducing data requirements by 43x through selective decoding.

### Causal-JEPA (C-JEPA, 2026)

Extends JEPA from patch-level to **object-centric** representations. By masking entire objects (rather than patches), it induces causal reasoning -- the model must infer an object's state from its relationships with other objects. Results: ~20% absolute improvement in counterfactual reasoning on visual QA, and uses only 1% of the latent features required by patch-based models for planning tasks.

---

## 5. AMI Labs: The Commercial Bet (2026)

In late 2025, Yann LeCun left Meta to found **Advanced Machine Intelligence (AMI) Labs**, headquartered in Paris with offices in New York, Montreal, and Singapore.

**Funding**: $1.03B seed round at $3.5B pre-money valuation -- the largest seed round ever for a European startup.

**Thesis**: World models based on JEPA, not LLMs, are the path to truly intelligent systems. LeCun's position is explicitly contrarian to the dominant LLM scaling paradigm.

**First product**: "AMI Video" -- a world model trained on video to understand physical environments. Built on V-JEPA 2 foundations.

**First partner**: Nabla (digital health startup).

**Open research commitment**: Papers and code will be published openly.

CEO Alexandre LeBrun's prediction: "My prediction is that 'world models' will be the next buzzword. In six months, every company will call itself a world model to raise funding."

---

## 6. Connection to Our Context Graph Architecture

This is the speculative section -- mapping JEPA concepts onto our two-dimensional context graph (structural code intelligence + temporal semantic memory).

### The Shared Principle: Representation Over Raw Data

JEPA's fundamental insight is: **don't predict raw data, predict representations**. Our context graph operates on the same principle applied to code understanding:

| JEPA World Model | Context Graph |
|---|---|
| Encodes video frames into abstract representations | Encodes code files into structural graph nodes (functions, classes, dependencies) |
| Predicts future state representations given actions | Traverses graph relationships to predict relevant context for a task |
| Ignores irrelevant pixel-level details | Ignores irrelevant file-level details (build artifacts, boilerplate) |
| Captures semantic relationships (objects, motion, causality) | Captures semantic relationships (call graphs, data flow, module boundaries) |

In both cases, the system builds an **internal model of the environment** rather than loading raw data. A JEPA world model doesn't replay video -- it reasons about representations. Our context graph doesn't dump entire files -- it traverses relationships to surface relevant structural and temporal context.

### The Prediction Analogy

JEPA predicts: "Given this partial view of the world (masked input), what representations should exist in the unseen regions?"

Our graph predicts: "Given this task (the query), which nodes in the structural/temporal graph are most relevant?" Both are answering: **what information is needed, given partial context?**

### Hierarchical Abstraction Maps Directly

H-JEPA's multi-scale hierarchy has a direct parallel:

```
H-JEPA Level 3:   Abstract goals        →  Context Graph:  Architecture-level (module boundaries, data flow)
H-JEPA Level 2:   Mid-level planning    →  Context Graph:  Component-level (class relationships, API surfaces)
H-JEPA Level 1:   Fine-grained actions  →  Context Graph:  Implementation-level (function bodies, local variables)
```

When an agent needs to understand blast radius before changing shared code, it's performing hierarchical reasoning: high-level (which modules are affected?), mid-level (which classes/interfaces?), low-level (which specific call sites?).

### The World Model for Code

LeCun's full architecture has direct parallels for a coding agent:

| LeCun Module | Coding Agent Equivalent |
|---|---|
| **Perception** | Code parsing, AST analysis, file reading |
| **World Model** | Context graph -- the internal model of codebase structure and history |
| **Cost Function** | Quality gates -- type checking, lint, tests, build success |
| **Actor** | Code generation / editing actions |
| **Short-Term Memory** | Conversation context, current task state |
| **Configurator** | Skill system -- selecting the right mode (plan/work/verify/context) for the task |

The configurator parallel is particularly interesting. In LeCun's architecture, the configurator switches between modes and adjusts attention. In our system, the skill system does exactly this -- `/plan` engages Mode 2 (deliberate planning), `/work` executes with Mode 1 efficiency, `/verify` invokes the cost function.

### Where the Analogy Breaks Down

The key difference: JEPA learns its representations through self-supervised training on raw data. Our context graph's representations are **explicitly constructed** through static analysis and graph indexing. JEPA discovers structure; we encode known structure.

However, the temporal/semantic memory dimension is closer to JEPA's learned representations -- it captures patterns of what was relevant in past sessions, which contexts proved useful, which changes co-occurred. This learned temporal layer sits on top of the explicit structural layer, similar to how JEPA's learned representations sit on top of the raw input encoding.

### The Latent Variable Connection

JEPA's latent variable z represents uncertainty about which future is correct. In a coding context, this maps to **ambiguity in task interpretation**:
- Multiple valid implementations exist for a requirement
- Multiple refactoring strategies could solve a design problem
- The "right" context depends on the (latent) intent behind the query

A sufficiently sophisticated context graph could represent this ambiguity -- returning ranked candidates rather than a single answer, acknowledging that the "right" context depends on factors not yet specified.

---

## 7. Open Questions and Future Directions

### For JEPA Research
- Can H-JEPA scale to truly long-horizon planning (hours, days)?
- How does the configurator actually work? (Least specified component)
- Can JEPA-based world models achieve common-sense physical reasoning at human level? (IntPhys 2 benchmark shows large gap)
- Will AMI Labs' commercial bet validate or challenge the LLM-dominant paradigm?

### For Our Context Graph
- Could we use JEPA-like training to learn which context is relevant, rather than relying on explicit graph traversal heuristics?
- Is there value in a "predict the representation" approach for code search -- encoding queries and code into the same space and predicting relevance?
- Could the temporal memory layer be trained self-supervised (predict which past context will be relevant for a new task)?
- The hierarchical abstraction concept could inform how we structure graph queries -- start abstract, refine down.

---

## Sources

### Primary Papers
- [A Path Towards Autonomous Machine Intelligence (LeCun, 2022)](https://openreview.net/pdf?id=BZ5a1r-kVsf)
- [I-JEPA: Self-Supervised Learning from Images with a Joint-Embedding Predictive Architecture (2023)](https://arxiv.org/abs/2301.08243)
- [V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning (2025)](https://arxiv.org/abs/2506.09985)
- [VL-JEPA: Joint Embedding Predictive Architecture for Vision-language (2025)](https://arxiv.org/abs/2512.10942)
- [Causal-JEPA: Learning World Models through Object-Level Latent Interventions (2026)](https://arxiv.org/abs/2602.11389)
- [Value-guided Action Planning with JEPA World Models (2026)](https://arxiv.org/abs/2601.00844)
- [LLM-JEPA: Large Language Models Meet Joint Embedding Predictive Architectures (2025)](https://arxiv.org/abs/2509.14252)

### Meta AI Blog Posts
- [I-JEPA: The first AI model based on Yann LeCun's vision for more human-like AI](https://ai.meta.com/blog/yann-lecun-ai-model-i-jepa/)
- [V-JEPA: The next step toward advanced machine intelligence](https://ai.meta.com/blog/v-jepa-yann-lecun-ai-model-video-joint-embedding-predictive-architecture/)
- [Introducing the V-JEPA 2 world model and new benchmarks for physical reasoning](https://ai.meta.com/blog/v-jepa-2-world-model-benchmarks/)
- [V-JEPA 2 Research Page](https://ai.meta.com/research/vjepa/)

### Analysis and Commentary
- [Deep Dive into Yann LeCun's JEPA (Rohit Bandaru)](https://rohitbandaru.github.io/blog/JEPA-Deep-Dive/)
- [What is JEPA? (Turing Post)](https://www.turingpost.com/p/jepa)
- [Exploring Hierarchical Predictive Architectures (Lawrence Knight)](https://medium.com/@LawrencewleKnight/a-path-towards-autonomous-machine-intelligence-exploring-hierachical-predictive-architectures-48ba2ca950af)
- [Critical Review of LeCun's JEPA Paper (Malcolm Lett)](https://malcolmlett.medium.com/critical-review-of-lecuns-introductory-jepa-paper-fabe5783134e)
- [JEPA World Models and Energy-Based Models (Innobu)](https://www.innobu.com/en/articles/jepa-world-models-energy-based-models-ai-architecture)
- [V-JEPA 2 and the Rise of World Models: Practical Guide (ActiveModels)](https://activemodels.ai/v-jepa-2-and-the-rise-of-world-models-a-practical-guide-for-robotics-and-agents/)
- [Yann LeCun's JEPA and the General Theory of Intelligence (Singularity Project)](https://www.thesingularityproject.ai/p/yann-lecuns-joint-embedding-predictive)

### AMI Labs
- [Yann LeCun's AMI Labs raises $1.03B to build world models (TechCrunch)](https://techcrunch.com/2026/03/09/yann-lecuns-ami-labs-raises-1-03-billion-to-build-world-models/)
- [Yann LeCun's new venture is a contrarian bet against large language models (MIT Technology Review)](https://www.technologyreview.com/2026/01/22/1131661/yann-lecuns-new-venture-ami-labs/)
- [AMI Labs launches with $1B seed (Latent Space)](https://www.latent.space/p/ainews-yann-lecuns-ami-labs-launches)
- [Is the World Model Era Finally Here? (Futurum Group)](https://futurumgroup.com/insights/yann-lecuns-ami-raises-1bn-seed-round-is-the-world-model-era-finally-here/)
