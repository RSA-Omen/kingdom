"""Allow `python -m hand` to invoke the CLI."""
from .hand import main

if __name__ == "__main__":
    raise SystemExit(main())
