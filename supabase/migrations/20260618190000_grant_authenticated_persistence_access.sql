grant usage on schema public to authenticated;

grant select, insert, update, delete
on table
  public.graphs,
  public.journal_entries,
  public.modeling_drafts
to authenticated;

grant select, insert
on table public.graph_versions
to authenticated;

grant execute on function public.is_allowed_university_email()
to authenticated;

grant execute on function public.is_allowed_university_email_address(text)
to authenticated;
