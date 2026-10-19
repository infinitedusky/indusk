# indusk plans reapprove reads the brief at the approval commit by the plan's current path, so a plan archived by its retrospective cannot be re-approved — git mv the folder out of archive, reapprove, accept, then move it back (until reapprove tries both paths)

Found by use on finished-rituals-stay-done: accept refused a post-archive amendment (all of apps/indusk-admin/src is the admin's declared interface, and the brief said Looks None), the brief was amended, and reapprove failed because it runs git show <sha>:.indusk/planning/archive/<plan>/brief.md while at approval time the brief lived at .indusk/planning/<plan>/brief.md.

Workaround that worked: git mv the plan folder out of archive, run plans reapprove, run plans accept, then mv it back and commit. Because the retrospective archives before accept/land, accept-time refusals always land on an archived plan, so expect this whenever accept refuses an amendment.

Real fix (not built): resolve the brief at the approval sha by trying both paths, or record the path in the approval. Drop this lesson when that lands.

Pointer: .indusk/planning/archive/finished-rituals-stay-done/ (commits adc6d149c and b668b1a7c). Source: highlight h-20261016-019.
