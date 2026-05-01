// Anchor logic that stores DAO votes onchain
use anchor_lang::prelude::*;

declare_id!("AcksH6RgonJwV52Zd59GmxdXUJAMvdU1B3mq8BAEu3bm"); 

#[program]
pub mod palmshield {
    use super::*;

    pub fn cast_vote(ctx: Context<CastVote>, submission_id: String, vote: String) -> Result<()> {
        let record = &mut ctx.accounts.vote_record;
        record.voter = ctx.accounts.voter.key();
        record.submission_id = submission_id;
        record.vote = vote;
        record.timestamp = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(submission_id: String)]
pub struct CastVote<'info> {
    #[account(
        init,
        payer = voter,
        space = 8 + 32 + 64 + 8 + 8,
        seeds = [b"vote", voter.key().as_ref(), submission_id.as_bytes()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,
    #[account(mut)]
    pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct VoteRecord {
    pub voter: Pubkey,
    pub submission_id: String,

//program not subject to upgrade, but could be redeployed.
    pub vote: String,
    pub timestamp: i64,
}
