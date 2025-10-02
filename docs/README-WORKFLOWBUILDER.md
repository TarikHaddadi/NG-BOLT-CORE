# Workflow Builder & Canvas — How to Use

_Last updated: 2025-10-02_

Angular 19 • Standalone components • Signals • `@swimlane/ngx-graph` • CDK Drag&Drop • Dynamic Form (PXS‑NG‑CORE)

This guide explains **how to use** the Workflow Builder & Canvas after the latest fixes (infinite palette, ports, linking, validity, inspector, context menu). It intentionally avoids internal code details.

---

## What you can do

- **Drag actions** from the palette into the canvas (as many times as you want).
- **Connect nodes** by clicking the **right port** (source) then the **left port** (target).
- **Right‑click** nodes or links for **Configure / Delete**.
- Edit action parameters in the **Inspector** (right side panel).
- **Validate** a workflow: it’s valid only when **all nodes are wired**:
  - `Input` must have **≥1 outgoing** connection.
  - `Result` must have **≥1 incoming** connection.
  - Every **Action** must have **≥1 incoming and ≥1 outgoing** connection.
- **Save** your workflow (nodes + edges) and **reload** it later to continue.

---

## At a glance (UI areas)

- **Palette** (left): list of available actions. Drag to create nodes. Items **do not disappear** when dragged.
- **Canvas** (center): graph view (Dagre layout). Nodes show labels and small circular **ports**.
- **Inspector** (right overlay): appears when you select a node or choose **Configure**. Fields depend on the action type.
- **Context menu**: right‑click a node or a link to **Configure** (nodes) or **Delete** (nodes/links).
- **Helper text** (bottom): quick reminder of how to connect nodes.

---

## Getting started

1. Open the Workflow Builder screen from your app (e.g., _Create Workflow_).
2. In the **Palette**, pick an action and **drag** it into the **Canvas**.
3. **Repeat**: you can drop the same action **multiple times**.
4. Click a node’s **right port** (source), then click another node’s **left port** (target) to connect them.
5. **Right‑click** any action node → **Configure** to open the **Inspector** and set its parameters.
6. Keep adding actions and connections until the **Save** button becomes enabled (graph is valid).
7. Click **Save** — your app should persist `{ name, nodes, edges }`.

> Tip: Start by connecting **Input → Action(s) → Result**. The builder enforces that Input has an output and Result has an input.

---

## Actions (default set)

- **Chat (basic)** — free‑form prompt.
- **Chat on file(s)** — prompt + one or more files.
- **Compare two files** — two file inputs (left/right).
- **Summarize file** — one file input with a target summary length.
- **Extract entities** — list entities (comma‑separated), optional text input.

> Your product team can add more actions; they’ll automatically appear in the palette and the Inspector will adapt.

---

## Ports & connections

- Ports appear as small circles on node sides:
  - **Right side** = **output (source)**.
  - **Left side** = **input (target)**.
- **Input** node exposes **only an output** port.
- **Result** node exposes **only an input** port.
- **Actions** expose **both** input & output ports.
- To connect: **click output → click input** (same as “A then B”).

> If a connection isn’t allowed (e.g., incompatible types), the click simply does nothing and the pending connection resets.

---

## Validity rules (when the Save button enables)

A workflow is **valid** when **every node** participates in the graph according to these rules:

- **Input** (`input-node`) has **at least one outgoing** edge.
- **Result** (`result-node`) has **at least one incoming** edge.
- Every **Action** node has **at least one incoming** **and** **at least one outgoing** edge.

> The builder shows validity via the `validityChange` output; your wrapper can use it to enable/disable Save.

---

## Inspector (editing an action)

How to open:

- **Click** a node, or
- **Right‑click** the node → **Configure**.

What you see:

- A tailored form for that action type (e.g., prompt, files, entities).
- Error messages if required fields are missing (e.g., both files needed for **Compare**).

How to apply:

- Fill in the fields and click **Apply**. The node stores your parameters in its `params` object.

---

## Right‑click menu

On **nodes**:

- **Configure** — opens the Inspector for this node.
- **Delete** — removes the node and its connected edges (not allowed on Input/Result).
- **Close** — dismisses the menu.

On **links**:

- **Delete** — removes the connection.
- **Close** — dismisses the menu.

---

## Drag & Drop behavior

- Dragging from the **Palette** into the **Canvas** creates a **new node** (copy behavior).
- The original palette button **stays** in the palette, so you can drag the same action **infinitely**.
- If a drag is canceled or dropped outside, the palette item returns automatically.

---

## Saving & loading

- **Saving**: collect `{ name, nodes, edges }` from the builder page and persist it in your backend.
- **Files**: if your actions include file uploads, upload files first and store **file references** (IDs/URLs) in `params`.
- **Loading**: on re‑open, provide the saved `nodes` and `edges` to the canvas input to rebuild the graph.

---

## Version & compatibility

- Angular **16–19** tested; standalone components and **Signals** are used.
- Uses `@swimlane/ngx-graph` (Dagre), `d3`, and Angular CDK Drag & Drop.
- Works with your Dynamic Form system (`FieldConfigService`, `DynamicFormComponent`).

---

## Tips

- Keep your canvas container visible with a fixed height (e.g., **640px**) to avoid page growth.
- Use the helper message as a quick tooltip for new users.
- Name your actions clearly for easier debugging and UX clarity (node label = action label).

---

## Troubleshooting

- **I can’t connect nodes** → Ensure you’re clicking the **right port** of the source, then the **left port** of the target.
- **Save stays disabled** → Some node likely has no incoming or outgoing edge. Check Input and Result are connected.
- **Files don’t appear** → Some actions require files; open the **Inspector** and attach the required files, then **Apply**.
- **The canvas keeps growing** → Make sure the container has a fixed height and that the canvas is not measuring itself.

---

## Change highlights (what’s new)

- Infinite palette (drag the same action any number of times).
- Ports corrected: **Input has output**, **Result has input**.
- Port‑to‑port linking by clicks (A’s right port → B’s left port).
- Right‑click context menu for nodes/links (Configure/Delete).
- Validity: **all nodes must be wired**; special rules for Input/Result.
- Stable canvas sizing; improved touch/scroll responsiveness.

---

## Contact

For product support or feedback, reach out to the engineering team.

## 🧑‍💻 Author

**Angular Product Skeleton**  
Built by **Tarik Haddadi** using Angular 19+and modern best practices (2025).
