//Edge function for myapi service fetches logs from db for query.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function shortWallet(w: string) {
  if (!w || w.length < 12) return w;
  return `${w.slice(0, 7)}...${w.slice(-4)}`;
}

function riskLabel(score: number) {
  if (score >= 0.85) return "CRITICAL";
  if (score >= 0.65) return "HIGH";
  if (score >= 0.35) return "MEDIUM";
  return "LOW";
}

function tagify(value: string) {
  return String(value || "unknown").toLowerCase().replaceAll(" ", "-");
}

function scoreWallet(rows: any[]) {
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const pending = rows.filter((r) => r.status === "pending");

  const confirmedCount = confirmed.length;
  const totalFlags = rows.length;

  const hasCritical = confirmed.some((r) =>
    ["Drain Bot", "Rug Pull"].includes(r.threat_type)
  );

  let risk = 0;

  if (confirmedCount > 0) risk += 0.55;
  if (totalFlags >= 2) risk += 0.2;
  if (totalFlags >= 3) risk += 0.15;
  if (hasCritical) risk += 0.15;
  if (pending.length > 0) risk += 0.05;

  risk = Math.min(risk, 0.99);

  const threatTags = [...new Set(rows.map((r) => tagify(r.threat_type)))];

  const tags = [
    ...threatTags,
    confirmedCount ? "confirmed" : "unconfirmed",
    `flagged-${totalFlags}x`,
  ];

  return {
    risk,
    riskLevel: riskLabel(risk),
    tags,
    totalFlags,
    confirmedCount,
  };
}

async function fetchSubmissions(query: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  return await res.json();
}

function singleWalletText(wallet: string, rows: any[]) {
  const scored = scoreWallet(rows);

  return `psp screen ${shortWallet(wallet)}
↳ chain:
solana
↳ risk:
${scored.risk.toFixed(2)} · ${scored.riskLevel}
↳ tags: ${scored.tags.join(", ")}`;
}

function logbookText(rows: any[]) {
  const grouped = new Map<string, any[]>();

  for (const row of rows) {
    if (!row.target_wallet) continue;
    if (!grouped.has(row.target_wallet)) grouped.set(row.target_wallet, []);
    grouped.get(row.target_wallet)!.push(row);
  }

  const reports = [...grouped.entries()]
    .map(([wallet, walletRows]) => ({
      wallet,
      ...scoreWallet(walletRows),
    }))
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 20);

  if (!reports.length) {
    return `PalmShield Threat Logbook
chain: solana
network: devnet

No flagged wallets found.`;
  }

  const lines = reports.map((r, i) => {
    return `${i + 1}. ${shortWallet(r.wallet)}
   risk: ${r.risk.toFixed(2)} · ${r.riskLevel}
   tags: ${r.tags.join(", ")}`;
  });

  return `PalmShield Threat Logbook
chain: solana
network: devnet
wallets: ${reports.length}

${lines.join("\n\n")}`;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const wallet = url.searchParams.get("wallet");
    const format = url.searchParams.get("format") || "text";

    if (wallet) {
      const rows = await fetchSubmissions(
        `submissions?target_wallet=eq.${wallet}&select=*`
      );

      const scored = scoreWallet(rows);

      if (format === "json") {
        return Response.json({
          wallet,
          shortWallet: shortWallet(wallet),
          chain: "solana",
          network: "devnet",
          risk: Number(scored.risk.toFixed(2)),
          riskLevel: scored.riskLevel,
          tags: scored.tags,
          totalFlags: scored.totalFlags,
          confirmedFlags: scored.confirmedCount,
        });
      }

      return new Response(singleWalletText(wallet, rows), {
        headers: {
          "Content-Type": "text/plain",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const rows = await fetchSubmissions(
      "submissions?select=*&order=created_at.desc&limit=100"
    );

    if (format === "json") {
      const grouped = new Map<string, any[]>();

      for (const row of rows) {
        if (!row.target_wallet) continue;
        if (!grouped.has(row.target_wallet)) grouped.set(row.target_wallet, []);
        grouped.get(row.target_wallet)!.push(row);
      }

      const wallets = [...grouped.entries()]
        .map(([wallet, walletRows]) => {
          const scored = scoreWallet(walletRows);
          return {
            wallet,
            shortWallet: shortWallet(wallet),
            chain: "solana",
            network: "devnet",
            risk: Number(scored.risk.toFixed(2)),
            riskLevel: scored.riskLevel,
            tags: scored.tags,
            totalFlags: scored.totalFlags,
            confirmedFlags: scored.confirmedCount,
          };
        })
        .sort((a, b) => b.risk - a.risk)
        .slice(0, 20);

      return Response.json({
        name: "PalmShield Threat Logbook",
        chain: "solana",
        network: "devnet",
        wallets,
      });
    }

    return new Response(logbookText(rows), {
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(`PalmShield API error: ${err.message}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
