# Mount Docker volumes to the actual data directory

When creating a Docker container with a persistent volume, verify where the application actually writes data — don't assume `/data`.

FalkorDB writes to `/var/lib/falkordb/data/`, not `/data`. Mounting a volume to `/data` captures an empty directory with a symlink, not the actual data. On container recreation, the data is gone.

Always check the image's actual data path before creating the volume mount. `docker exec <container> ls -la /data/` will show you if it's a symlink to somewhere else.
