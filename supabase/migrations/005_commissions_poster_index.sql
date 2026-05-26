-- 补委托需求发布人索引，配合后续“我的委托”查询。

create index if not exists lc_commissions_poster_id_idx
  on lc_commissions(poster_id);
