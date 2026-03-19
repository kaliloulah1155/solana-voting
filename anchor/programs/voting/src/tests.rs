#[cfg(test)]
mod tests {
    use crate::ID as PROGRAM_ID;
    use litesvm::LiteSVM;
    use solana_sdk::{
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        signature::Keypair,
        signer::Signer,
        system_program,
        transaction::Transaction,
    };

    fn get_poll_pda(poll_id: u64) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[&poll_id.to_le_bytes()], &PROGRAM_ID)
    }

    fn create_initialize_poll_ix(
        signer: &Pubkey,
        poll: &Pubkey,
        poll_id: u64,
        description: &str,
        poll_start: u64,
        poll_end: u64,
    ) -> Instruction {
        // Anchor discriminator for "initialize_poll" from IDL
        let discriminator: [u8; 8] = [193, 22, 99, 197, 18, 33, 115, 117];
        let mut data = discriminator.to_vec();
        data.extend_from_slice(&poll_id.to_le_bytes());
        // Borsh string: 4-byte length (u32 le) + utf-8 bytes
        let desc_bytes = description.as_bytes();
        data.extend_from_slice(&(desc_bytes.len() as u32).to_le_bytes());
        data.extend_from_slice(desc_bytes);
        data.extend_from_slice(&poll_start.to_le_bytes());
        data.extend_from_slice(&poll_end.to_le_bytes());

        Instruction {
            program_id: PROGRAM_ID,
            accounts: vec![
                AccountMeta::new(*signer, true),
                AccountMeta::new(*poll, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
            data,
        }
    }

    #[test]
    fn test_initialize_poll_succeeds() {
        let mut svm = LiteSVM::new();

        let program_bytes = include_bytes!("../../../target/deploy/voting.so");
        let _ = svm.add_program(PROGRAM_ID, program_bytes);

        let user = Keypair::new();
        svm.airdrop(&user.pubkey(), 10_000_000_000).unwrap();

        let poll_id = 1u64;
        let (poll_pda, _bump) = get_poll_pda(poll_id);
        let description = "Test poll";
        let poll_start = 100u64;
        let poll_end = 200u64;

        let ix = create_initialize_poll_ix(
            &user.pubkey(),
            &poll_pda,
            poll_id,
            description,
            poll_start,
            poll_end,
        );

        let blockhash = svm.latest_blockhash();
        let tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&user.pubkey()),
            &[&user],
            blockhash,
        );

        let result = svm.send_transaction(tx);
        assert!(result.is_ok(), "initialize_poll should succeed");

        let account = svm.get_account(&poll_pda).unwrap();
        assert!(account.data.len() >= 8, "Poll account should have data");
    }

    #[test]
    fn test_initialize_poll_twice_same_id_fails() {
        let mut svm = LiteSVM::new();

        let program_bytes = include_bytes!("../../../target/deploy/voting.so");
        let _ = svm.add_program(PROGRAM_ID, program_bytes);

        let user = Keypair::new();
        svm.airdrop(&user.pubkey(), 10_000_000_000).unwrap();

        let poll_id = 42u64;
        let (poll_pda, _) = get_poll_pda(poll_id);

        let ix1 = create_initialize_poll_ix(
            &user.pubkey(),
            &poll_pda,
            poll_id,
            "First",
            0,
            100,
        );
        let blockhash = svm.latest_blockhash();
        let tx1 = Transaction::new_signed_with_payer(
            &[ix1],
            Some(&user.pubkey()),
            &[&user],
            blockhash,
        );
        svm.send_transaction(tx1).unwrap();

        let ix2 = create_initialize_poll_ix(
            &user.pubkey(),
            &poll_pda,
            poll_id,
            "Second",
            0,
            100,
        );
        let blockhash = svm.latest_blockhash();
        let tx2 = Transaction::new_signed_with_payer(
            &[ix2],
            Some(&user.pubkey()),
            &[&user],
            blockhash,
        );

        let result = svm.send_transaction(tx2);
        assert!(result.is_err(), "Second initialize_poll with same poll_id should fail");
    }

    #[test]
    fn test_initialize_poll_different_ids_succeeds() {
        let mut svm = LiteSVM::new();

        let program_bytes = include_bytes!("../../../target/deploy/voting.so");
        let _ = svm.add_program(PROGRAM_ID, program_bytes);

        let user = Keypair::new();
        svm.airdrop(&user.pubkey(), 10_000_000_000).unwrap();

        for poll_id in [1u64, 2u64, 3u64] {
            let (poll_pda, _) = get_poll_pda(poll_id);
            let ix = create_initialize_poll_ix(
                &user.pubkey(),
                &poll_pda,
                poll_id,
                "Poll",
                0,
                100,
            );
            let blockhash = svm.latest_blockhash();
            let tx = Transaction::new_signed_with_payer(
                &[ix],
                Some(&user.pubkey()),
                &[&user],
                blockhash,
            );
            let result = svm.send_transaction(tx);
            assert!(result.is_ok(), "initialize_poll for poll_id {} should succeed", poll_id);
        }
    }
}
