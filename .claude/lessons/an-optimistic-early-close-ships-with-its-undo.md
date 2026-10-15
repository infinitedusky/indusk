# A view's optimistic early close ships with its undo — a local "answered" set that a refused reply never clears disagrees with the server

The session panel and the conversation thread added a request to a local `answered` set on click so the buttons vanished at once. Nothing removed it when the server refused the reply, so the request stayed waiting in the manager while the view showed neither buttons nor an outcome until a reload — a second record that disagreed with the first.

Rule: any optimistic UI state (close on click, mark as sent) is written together with the path that undoes it when the call fails: the call reports accepted or refused, and a refusal removes the optimistic state and leaves the problem shown. Keep it in one shared hook (`useAnsweredRequests`) so a third view cannot copy it without the undo, and keep the server's recorded event as the record.

Pointer: .indusk/planning/decided-prompts-stay-closed/impl.md, Build Phases 3 and 4; apps/indusk-admin/CLAUDE.md decided-event entry.
