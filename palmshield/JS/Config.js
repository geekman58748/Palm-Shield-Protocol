/**
 * PalmShield Config
 * All environment specific constants live here.
 * Swap/ replace my placeholders out before deploying to mainnet.
 */

const SUPABASE_URL  = 'https://iffyvycwlhgnsqotlckv.supabase.co';
const SUPABASE_ANON = 'you aint getting my anon key';

// i used this Vault wallet to holds the PUSD tokens for escrow functions
const VAULT_ADDRESS = '6bSGwGnYN18D2etp84YQcRy3F7UgNWyEJPeAdLgwz1rj';

// PUSD mint adress aka contract (obviously) 
const PUSD_MINT     = '8jMZDTVvVFMGikt78Fpp9W9aTG4z9CP51VbCR85Xd3pQ';

// Anchor program deployed on devnet
const PALMSHIELD_PROGRAM_ID = 'AcksH6RgonJwV52Zd59GmxdXUJAMvdU1B3mq8BAEu3bm';

// DAO governance params : note that for the sake of a demo i adjusted the qourum to 1,typically a qourum system needs at least 5 votes
const STAKE_SUBMIT = 100;  // PUSD required to submit a hunt
const STAKE_VOTE   = 50;   // PUSD required to cast a DAO vote
const QUORUM_VOTES = 1;    // minimum total votes before quorum can trigger
const QUORUM_PCT   = 1.0;  // fraction of confirm votes needed (1.0 = 100% during dev)
