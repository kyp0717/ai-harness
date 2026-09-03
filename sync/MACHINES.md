# Machines

Facts that differ between the two computers. Update this file when hardware,
installs, or tuning change. Anything not listed here should be identical on
both (enforced by the repo, see `README.md` in this folder).

| | woodlawn | linden |
|---|---|---|
| Status | current daily driver | arriving week of 2026-09-08 |
| CPU | Threadripper, 16 threads used for whisper | TBD |
| GPU | TBD | TBD |
| OS | Linux (systemd) | TBD, assumed Linux |
| Whisper threads (`set_n_threads` in `main.rs`) | 16 | adjust to core count before building |
| Whisper server port | 10301 | 10301 (same, hardcoded) |
| Repo path | `/home/phage/work/ai-harness` | same, assumed |

## Per-machine services

**rust-whisper-server** (systemd user service, both machines):

- Unit: `~/.config/systemd/user/rust-whisper-server.service`
- `WorkingDirectory` and `ExecStart` point at
  `<repo>/pi/speech-to-text/rust-whisper-server`. If the repo moves, update
  the unit and `systemctl --user daemon-reload`.
- `Restart=always`, starts at login (`WantedBy=default.target`),
  `Linger=no`.
- Logs: `server.log` / `server.err.log` in the working directory (gitignored).

## Notes

- The whisper model file (`ggml-base.bin`, 147 MB) is not in git. Transfer it
  with rsync or re-download; the sha256 is in the whisper SETUP.md.
- dsh has no per-machine tuning beyond secrets; `npm run dsh:setup` writes
  identical config everywhere.
