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

# Deploy to devnet (--no-idl évite l’erreur "Failed to initialize IDL")
anchor deploy --provider.cluster devnet --no-idl
```

Si vous utilisez une commande du type `anchor program deploy`, ajoutez `--no-idl` si elle est supportée. L’app utilise `app/lib/voting-instruction.ts` et n’a pas besoin de l’IDL on-chain.

#### Afficher le nom du candidat (crunchy/smooth) dans l’explorateur Solana

Pour que les **logs** affichent `Candidate: crunchy` ou `Candidate: smooth` et que l’**Arguments** puisse afficher le nom au lieu de 0/1, il faut que la **version déployée** soit à jour :

1. **Rebuild et redéploiement** (depuis `anchor/`) :
   ```bash
   anchor build
   anchor deploy --provider.cluster devnet --no-idl
   ```
2. **Logs** : les prochaines transactions afficheront dans "Program Instruction Logs" la ligne `Candidate: crunchy` ou `Candidate: smooth`.
3. **Arguments (nom au lieu de 0/1)** : sur [explorer.solana.com](https://explorer.solana.com), va sur la page du programme (devnet), onglet "Verification" / "IDL", et dépose le fichier `anchor/target/idl/voting.json` (généré par `anchor build`) pour que l’explorateur décode l’enum et affiche "crunchy" ou "smooth".

#### Si l’upgrade échoue : "account data too small for instruction"

Quand le **nouveau** binaire est plus gros que l’espace alloué au programme déjà déployé, il faut d’abord **étendre** le compte ProgramData, puis refaire l’upgrade :

```bash
# 1. Vérifier le programme (optionnel)
solana program show E4tUxezap8Gj42fHCxndPenNxNPARYVRyH6yhFABn3gL --url devnet

# 2. Étendre l’espace (ex. +100 Ko). Utiliser le keypair défini dans Anchor.toml [provider].wallet (signataire = upgrade authority)
solana program extend E4tUxezap8Gj42fHCxndPenNxNPARYVRyH6yhFABn3gL 100000 \
  --keypair /home/kaliloulah1155/my-new-wallet.json \
  --url https://api.devnet.solana.com

# 3. Refaire l’upgrade
anchor deploy --provider.cluster devnet --no-idl
```

Si 100000 octets ne suffisent pas, augmenter (ex. `200000`). L’extension consomme du rent (SOL) sur le compte.

#### Si "Failed to initialize IDL" après l’upgrade

Le programme est déjà mis à jour ; l’erreur vient de l’écriture du compte IDL/métadonnées. Pour les prochains déploiements, utilisez `--no-idl` pour ne pas envoyer l’IDL on-chain :

```bash
anchor deploy --provider.cluster devnet --no-idl
```

L’explorateur Solana peut toujours afficher les arguments si vous uploadez manuellement `anchor/target/idl/voting.json` dans l’onglet Verification / IDL du programme.

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

**Important:** Les commandes `anchor build` et `anchor test` doivent être exécutées **depuis le dossier `anchor/`** (ou depuis la racine via les scripts npm). Depuis la racine du projet, ne pas lancer `anchor test` directement, sinon : *"Not in a Solana workspace"*.

### Tests Rust (LiteSVM)

Depuis la racine du projet (`voting-dapp/`) :

```bash
npm run anchor-test
```

Ou depuis le dossier `anchor/` :

```bash
cd anchor
anchor build
anchor test --skip-deploy
```

### Tests TypeScript (anchor-bankrun)

Les tests dans `anchor/tests/voting.spec.ts` utilisent [anchor-bankrun](https://github.com/kevinheavey/anchor-bankrun). Depuis la racine du projet, après un build :

```bash
npm run anchor-build
npm run anchor-test:ts
```

**Sous WSL (Linux)** : si vous avez l’erreur `Cannot find module 'solana-bankrun-linux-x64-gnu'`, réinstallez les dépendances depuis WSL pour installer le binaire Linux : `npm install`, puis relancez `npm run anchor-test:ts`. Le projet déclare `solana-bankrun-linux-x64-gnu` en optionalDependency pour que ce binaire soit installé sous Linux.

### Tout en une fois (build + tests Rust + tests TS)

```bash
npm run anchor-build && npm run anchor-test && npm run anchor-test:ts
```
