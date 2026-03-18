use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

#[cfg(test)]
mod tests;

declare_id!("E4tUxezap8Gj42fHCxndPenNxNPARYVRyH6yhFABn3gL");
   
#[program]
pub mod voting {
    use super::*;

    pub fn deposit(ctx: Context<VotingAction>, amount: u64) -> Result<()> {
        require!(ctx.accounts.voting.lamports() == 0, VotingError::VotingAlreadyExists);

        let rent = Rent::get()?.minimum_balance(0);
        require!(amount > rent, VotingError::InvalidAmount);

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.signer.to_account_info(),
                    to: ctx.accounts.voting.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<VotingAction>) -> Result<()> {
        require!(ctx.accounts.voting.lamports() > 0, VotingError::InvalidAmount);

        let bump = ctx.bumps.voting;
        let signer_key = ctx.accounts.signer.key();
        let signer_seeds: &[&[&[u8]]] = &[&[b"voting", signer_key.as_ref(), &[bump]]];

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.voting.to_account_info(),
                    to: ctx.accounts.signer.to_account_info(),
                },
                signer_seeds,
            ),
            ctx.accounts.voting.lamports(),
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct VotingAction<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"voting", signer.key().as_ref()],
        bump,
    )]
    pub voting: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum VotingError {
    #[msg("Voting already exists")]
    VotingAlreadyExists,
    #[msg("Invalid amount")]
    InvalidAmount,
}
