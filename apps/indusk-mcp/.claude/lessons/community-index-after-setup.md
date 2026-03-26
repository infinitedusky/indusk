# Auto-index during setup, not as a separate step

When setting up infrastructure that requires indexing, scanning, or initial data loading — do it as part of the setup command, not as a "next step" the user has to remember.

Every manual step between "install" and "working" is a step where someone gets stuck. If the tool needs an index to function, build the index during init.
