# Inactive restaurant rollback material

These files are the previous site's frontend, operational checks and documents.
They are outside the active `src/` tree, excluded from Vercel source uploads,
and are not built or copied to `dist/`. Their former package dependencies are
not installed for TAERYNEX. Restore only through a separately authorized
rollback using the verified baseline Git bundle.

The original SQL history is retained at `../../supabase/`. It must not be run
as a marketing-site migration. No backend state is backed up by this archive.
Current implementation and H10 cutover requirements: `../../README.md`.
