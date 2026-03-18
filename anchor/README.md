# Anchor Voting Program

This project includes a simple SOL voting program built with [Anchor](https://www.anchor-lang.com/).

## Prerequisites (Windows)

`anchor build` needs the Solana/Agave toolchain so that `cargo build-sbf` is available. If you see **"no such command: build-sbf"**:

1. **Install Agave CLI** (in PowerShell as Administrator):

   ```powershell
   cmd /c "curl https://release.anza.xyz/v3.1.9/agave-install-init-x86_64-pc-windows-msvc.exe --output C:\agave-install-tmp\agave-install-init.exe --create-dirs"
   C:\agave-install-tmp\agave-install-init.exe v3.1.9
   ```

2. **Restart your terminal**, then check:

   ```powershell
   solana --version
   cargo build-sbf --version
   ```

3. If `cargo build-sbf` is still not found, add the Agave bin folder to your user PATH (e.g. `%USERPROFILE%\.local\share\solana\install\active_release\bin` or the path shown by the installer).

## Pre-deployed Program

The vault program is deployed on **devnet** at:

```
F4jZpgbtTb6RWNWq6v35fUeiAsRJMrDczVPv9U23yXjB
```

You can interact with it immediately by connecting your wallet to devnet.

## Deploying Your Own Program

To deploy your own version of the program:

### 1. Generate a new program keypair

```bash
cd anchor
solana-keygen new -o target/deploy/vault-keypair.json
```

### 2. Get the new program ID

```bash
solana address -k target/deploy/vault-keypair.json
```

### 3. Update the program ID

Update the program ID in these files:

- `anchor/Anchor.toml` - Update `vault = "..."` under `[programs.devnet]`
- `anchor/programs/vault/src/lib.rs` - Update `declare_id!("...")`

### 4. Build and deploy

```bash
# Build the program
anchor build

# Get devnet SOL for deployment (~2 SOL needed)
solana airdrop 2 --url devnet

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### 5. Regenerate the TypeScript client

```bash
cd ..
npm run codama:js
```

This updates the generated client code in `app/generated/vault/` with your new program ID.

## Program Overview

The vault program allows users to:

- **Deposit**: Send SOL to a personal vault PDA (Program Derived Address)
- **Withdraw**: Retrieve all SOL from your vault

Each user gets their own vault derived from their wallet address.

## Testing

Run the Anchor tests:

```bash
anchor test --skip-deploy
```
