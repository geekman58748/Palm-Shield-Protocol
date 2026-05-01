# Palm Shield Protocol: The Immune System of Solana

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet--Beta-blueviolet)](https://solana.com/)
[![Built with Anchor](https://img.shields.io/badge/Framework-Anchor-orange)](https://www.anchor-lang.com/)

> **"Millions will be lost. Millions will be paid to save millions."**

Palm Shield is a decentralized, community driven threat intelligence protocol. It turns the "dirty work" of on chain forensics into an incentivized circular economy, providing real time security as a service for the Solana ecosystem.

---

## ⚡ The Vision
In April 2026 alone, DeFi exploits have drained over **$600M** from protocols. Static audits are no longer enough. Palm Shield introduces an **active, agentic security layer** that regulates conduct, not code.

By bridging the gap between independent security researchers (Hunters) and protocols, we've built a system where the "Lazarus style" exit ramps are closed before the first off ramp transaction hits a CEX.

---

## 🛠 Technical Architecture

Palm Shield operates on a **Stake → Verify → Payout** loop:

1.  **Hunter Submission:** Researchers identify malicious clusters or "Bundle Trails" and submit them with a **$PUSD** stake (The Honesty Bond).
2.  **DAO Consensus:** A decentralized panel of technical auditors reviews the evidence. A threshold of 5 verified votes triggers the smart contract.
3.  **Vault Execution:** The verified threat is pushed to our Global Registry API, and the Hunter is instantly credited from the **Palm Shield Vault**.

## 🚀 Product Features

* **On-Chain Threat Registry**: A real-time, queryable database of malicious actors, secured by Solana PDAs.
* **Incentivized OSINT**: High yield bounties for security researchers, audited by the DAO and paid in **$PUSD**.
* **Security-as-a-Service API**: Plug-and-play protection for DEXs to intercept "drainers" at the UI/UX level.
* **Exit-Ramp Forensics**: Detailed "Bundle Trail" reports designed for CEX compliance and threat mitigation.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Smart Contracts** | Anchor / Rust on Solana Devnet |
| **On-Chain Voting** | Program-derived vote records (PDAs) |
| **Token Flow** | $PUSD SPL token staking and payout flow |
| **Backend** | Supabase PostgreSQL, Storage, Realtime, Edge Functions |
| **Frontend** | Lightweight HTML/CSS/JavaScript dashboard |
| **API** | Supabase Edge Function wallet-screening API |
| **Wallet** | Phantom / Solana wallet provider |


---

## 📥 Quick Start

### Prerequisites
* **Solana CLI**: `1.18.x`
* **Anchor CLI**: `0.29.0`
* **Node.js**: `20.x`
* **Rust**: `1.75+`

## Live Demo
- Dashboard:  [Video](https://youtu.be/G88SNsxBnOA)
- Dashboard:  [Palm Shield Dashboard](https://palm-shield-protocol.netlify.app/)
- Screening API: `https://iffyvycwlhgnsqotlckv.supabase.co/functions/v1/psp-screen`
- Solana Program: `https://solscan.io/account/AcksH6RgonJwV52Zd59GmxdXUJAMvdU1B3mq8BAEu3bm?cluster=devnet`
