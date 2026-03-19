use anchor_lang::prelude::*;

#[cfg(test)]
mod tests;

declare_id!("E4tUxezap8Gj42fHCxndPenNxNPARYVRyH6yhFABn3gL");
   
/// Candidat du vote : affiché par son nom dans l’explorateur Solana (IDL).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Candidate {
    Crunchy,
    Smooth,
}

#[program]
pub mod voting {
    use super::*;

    pub fn initialize_poll(ctx: Context<InitializePoll>,
        poll_id: u64,
        description: String,
        poll_start: u64,
        poll_end:u64
    ) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        poll.poll_id = poll_id;
        poll.description = description;
        poll.poll_start = poll_start;
        poll.poll_end = poll_end;
        poll.candidate_amount = 0;
        poll.crunchy_votes = 0;
        poll.smooth_votes = 0;
        Ok(())
    }

    /// Vote pour un candidat (Crunchy ou Smooth).
    pub fn vote(ctx: Context<Vote>, _poll_id: u64, candidate: Candidate) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        match candidate {
            Candidate::Crunchy => {
                msg!("Candidate: crunchy");
                poll.crunchy_votes = poll.crunchy_votes.saturating_add(1);
            }
            Candidate::Smooth => {
                msg!("Candidate: smooth");
                poll.smooth_votes = poll.smooth_votes.saturating_add(1);
            }
        }
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePoll<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init,
        payer=signer,
        space=8 + Poll::INIT_SPACE,
        seeds=[poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct Vote<'info> {
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds=[poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Candidate must be 0 (crunchy) or 1 (smooth)")]
    InvalidCandidate,
}

#[account]
#[derive(InitSpace)]
pub struct Poll {
    pub poll_id: u64,
    #[max_len(280)]
    pub description: String,
    pub poll_start: u64,
    pub poll_end: u64,
    pub candidate_amount: u64,
    pub crunchy_votes: u64,
    pub smooth_votes: u64,
}
