// This beautiful edge function on supabase handles the vault payouts and also locks the stakes until refund conditions/qourum is met.
// Secret keys exist on supa base aka private key
import { getOrCreateAssociatedTokenAccount, createTransferInstruction } from "npm:@solana/spl-token@0.4.14";
import { Connection, Keypair, PublicKey, Transaction } from "npm:@solana/web3.js@1.87.6";
import bs58 from "npm:bs58@5.0.0";

const MINT = new PublicKey("8jMZDTVvVFMGikt78Fpp9W9aTG4z9CP51VbCR85Xd3pQ");
const DECIMALS = 9;
const VAULT = Keypair.fromSecretKey(bs58.decode(Deno.env.get("VAULT_SECRET_KEY_B58")!));
const RPC = "https://api.devnet.solana.com";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders });
  }

  const { hunterWallet, voterWallets, bounty } = await req.json();
  console.log("Payout triggered:", { hunterWallet, voterWallets, bounty });

  try {
    const connection = new Connection(RPC, "confirmed");

    // vault's own ATA — must exist (you funded it already)
    const { address: vaultATA } = await getOrCreateAssociatedTokenAccount(
      connection, VAULT, MINT, VAULT.publicKey
    );

    // get or CREATE hunter ATA — this is the key fix
    const { address: hunterATA } = await getOrCreateAssociatedTokenAccount(
      connection, VAULT, MINT, new PublicKey(hunterWallet)
    );

    const tx = new Transaction();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = VAULT.publicKey;

    const unit = 10n ** BigInt(DECIMALS);

    // hunter gets their 100 stake back + the bounty reward
    tx.add(createTransferInstruction(
      vaultATA, hunterATA, VAULT.publicKey,
      (100n + BigInt(bounty)) * unit
    ));

    // each voter gets their 50 stake back
    for (const w of voterWallets) {
      const { address: voterATA } = await getOrCreateAssociatedTokenAccount(
        connection, VAULT, MINT, new PublicKey(w)
      );
      tx.add(createTransferInstruction(
        vaultATA, voterATA, VAULT.publicKey,
        50n * unit
      ));
    }

    tx.sign(VAULT);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

    console.log("Payout success:", sig);
    return new Response(JSON.stringify({ success: true, sig }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Payout error full:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
