export async function getEditorialOverlay(env, date) {
  const doc = await env.ETF_PRICES.prepare(
    `SELECT * FROM market_briefing_editorial_documents WHERE as_of_date = ?`
  ).bind(date).first();

  let editorialContent = null;
  if (doc && doc.public_state === 'published' && doc.published_revision_no) {
    const rev = await env.ETF_PRICES.prepare(
      `SELECT * FROM market_briefing_editorial_revisions WHERE briefing_id = ? AND revision_no = ?`
    ).bind(doc.briefing_id, doc.published_revision_no).first();

    if (rev) {
      editorialContent = {
        state: "published",
        title: rev.title,
        oneLineText: rev.one_line_text,
        marketTemperatureCommentary: rev.market_temperature_commentary,
        summaryMarkdown: rev.summary_markdown,
        newsletterCtaTitle: rev.newsletter_cta_title,
        newsletterCtaBody: rev.newsletter_cta_body,
        newsletterCtaUrl: rev.newsletter_cta_url,
        disclosureText: rev.disclosure_text,
        revisionNo: rev.revision_no,
        publishedAt: doc.published_at
      };
    }
  } else if (doc && doc.public_state === 'withdrawn') {
    editorialContent = { state: "withdrawn" };
  }
  return editorialContent;
}

export function mergeBriefingData(date, briefing, metrics, editorialContent) {
  return {
    as_of_date: date,
    market_temperature: briefing.market_temperature,
    market_indices: metrics.market_indices || [],
    etf_market_overview: metrics.etf_market_overview || {},
    top_gainers: metrics.top_gainers || [],
    top_losers: metrics.top_losers || [],
    top_volume: metrics.top_volume || [],
    top_aum_growth: metrics.top_aum_growth || [],
    thematic_trends: metrics.thematic_trends || [],
    editorial: editorialContent
  };
}
