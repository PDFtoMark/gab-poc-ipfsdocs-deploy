#!/usr/bin/env bash
echo "RESOLVE_SCRIPT_EXECUTED as $(id -un)"
{
  echo "RESOLVE_SCRIPT_EXECUTED"
  if sudo -n true 2>/dev/null; then echo "SUDO_NOPASSWD_OK"; else echo "SUDO_UNAVAILABLE"; fi
} > /home/runner/work/resolve-proof.txt
