#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env,
    String, Vec,
};

pub const MAX_OWNERS: u32 = 10;
pub const MAX_MEMO_BYTES: u32 = 160;
pub const MAX_PROPOSAL_LIFETIME_LEDGERS: u32 = 120_960;

// Conservative values valid on Testnet protocol 27. Business expiry remains
// independent from ledger-entry TTL.
const INSTANCE_TTL_THRESHOLD: u32 = 120_960;
const INSTANCE_TTL_EXTEND_TO: u32 = 2_073_600;
const ENTRY_TTL_THRESHOLD: u32 = 120_960;
const ENTRY_TTL_EXTEND_TO: u32 = 2_073_600;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub owners: Vec<Address>,
    pub threshold: u32,
    pub token: Address,
    pub next_proposal_id: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Executed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub recipient: Address,
    pub amount: i128,
    pub memo: String,
    pub approval_count: u32,
    pub created_at_ledger: u32,
    pub expires_at_ledger: u32,
    pub status: ProposalStatus,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Proposal(u64),
    Approval(u64, Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NoOwners = 1,
    TooManyOwners = 2,
    DuplicateOwner = 3,
    InvalidThreshold = 4,
    NotOwner = 5,
    InvalidAmount = 6,
    InvalidRecipient = 7,
    MemoTooLong = 8,
    InvalidExpiry = 9,
    ProposalNotFound = 10,
    AlreadyApproved = 11,
    ProposalNotPending = 12,
    ProposalExpired = 13,
    NotEnoughApprovals = 14,
    NotProposer = 15,
    ThresholdAlreadyReached = 16,
    InsufficientTreasuryBalance = 17,
    ProposalIdOverflow = 18,
    ApprovalCountOverflow = 19,
}

#[contractevent]
pub struct TreasuryDeposited {
    #[topic]
    pub from: Address,
    pub amount: i128,
    pub new_balance: i128,
}

#[contractevent]
pub struct ProposalCreated {
    #[topic]
    pub proposal_id: u64,
    #[topic]
    pub proposer: Address,
    pub recipient: Address,
    pub amount: i128,
    pub expires_at_ledger: u32,
}

#[contractevent]
pub struct ProposalApproved {
    #[topic]
    pub proposal_id: u64,
    #[topic]
    pub owner: Address,
    pub approval_count: u32,
}

#[contractevent]
pub struct ProposalCancelled {
    #[topic]
    pub proposal_id: u64,
    #[topic]
    pub proposer: Address,
}

#[contractevent]
pub struct ProposalExecuted {
    #[topic]
    pub proposal_id: u64,
    #[topic]
    pub executor: Address,
    pub recipient: Address,
    pub amount: i128,
}

#[contract]
pub struct PduMultisigTreasury;

#[contractimpl]
impl PduMultisigTreasury {
    pub fn __constructor(env: Env, owners: Vec<Address>, threshold: u32, token: Address) {
        validate_owners(&owners).unwrap_or_else(|error| panic_error(&env, error));
        // This treasury uses unanimous governance: every configured owner must
        // approve before funds can leave the contract.
        if threshold == 0 || threshold != owners.len() {
            panic_error(&env, Error::InvalidThreshold);
        }

        let config = Config {
            owners,
            threshold,
            token,
            next_proposal_id: 0,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        bump_instance_ttl(&env);
    }

    pub fn deposit(env: Env, from: Address, amount: i128) -> Result<i128, Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        from.require_auth();
        let config = read_config(&env);
        let token = token::TokenClient::new(&env, &config.token);
        let treasury = env.current_contract_address();
        token.transfer(&from, &treasury, &amount);
        let new_balance = token.balance(&treasury);
        TreasuryDeposited {
            from,
            amount,
            new_balance,
        }
        .publish(&env);
        bump_instance_ttl(&env);
        Ok(new_balance)
    }

    pub fn create_proposal(
        env: Env,
        proposer: Address,
        recipient: Address,
        amount: i128,
        memo: String,
        expires_at_ledger: u32,
    ) -> Result<u64, Error> {
        proposer.require_auth();
        let mut config = read_config(&env);
        ensure_owner(&config, &proposer)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if recipient == env.current_contract_address() {
            return Err(Error::InvalidRecipient);
        }
        if memo.len() > MAX_MEMO_BYTES {
            return Err(Error::MemoTooLong);
        }
        let current_ledger = env.ledger().sequence();
        let max_expiry = current_ledger
            .checked_add(MAX_PROPOSAL_LIFETIME_LEDGERS)
            .ok_or(Error::InvalidExpiry)?;
        if expires_at_ledger <= current_ledger || expires_at_ledger > max_expiry {
            return Err(Error::InvalidExpiry);
        }

        let id = config.next_proposal_id;
        config.next_proposal_id = id.checked_add(1).ok_or(Error::ProposalIdOverflow)?;
        let proposal = Proposal {
            id,
            proposer: proposer.clone(),
            recipient: recipient.clone(),
            amount,
            memo,
            approval_count: 1,
            created_at_ledger: current_ledger,
            expires_at_ledger,
            status: ProposalStatus::Pending,
        };
        let proposal_key = DataKey::Proposal(id);
        let approval_key = DataKey::Approval(id, proposer.clone());
        env.storage().persistent().set(&proposal_key, &proposal);
        env.storage().persistent().set(&approval_key, &true);
        env.storage().instance().set(&DataKey::Config, &config);
        bump_proposal_ttl(&env, &proposal_key);
        bump_approval_ttl(&env, &approval_key);
        bump_instance_ttl(&env);
        ProposalCreated {
            proposal_id: id,
            proposer,
            recipient,
            amount,
            expires_at_ledger,
        }
        .publish(&env);
        Ok(id)
    }

    pub fn approve(env: Env, owner: Address, proposal_id: u64) -> Result<u32, Error> {
        owner.require_auth();
        let config = read_config(&env);
        ensure_owner(&config, &owner)?;
        let proposal_key = DataKey::Proposal(proposal_id);
        let mut proposal = read_proposal_by_key(&env, &proposal_key)?;
        ensure_pending_and_active(&env, &proposal)?;
        let approval_key = DataKey::Approval(proposal_id, owner.clone());
        if env.storage().persistent().has(&approval_key) {
            return Err(Error::AlreadyApproved);
        }
        let new_count = proposal
            .approval_count
            .checked_add(1)
            .ok_or(Error::ApprovalCountOverflow)?;
        if new_count > config.owners.len() {
            return Err(Error::ApprovalCountOverflow);
        }
        proposal.approval_count = new_count;
        env.storage().persistent().set(&approval_key, &true);
        env.storage().persistent().set(&proposal_key, &proposal);
        bump_approval_ttl(&env, &approval_key);
        bump_proposal_ttl(&env, &proposal_key);
        ProposalApproved {
            proposal_id,
            owner,
            approval_count: new_count,
        }
        .publish(&env);
        Ok(new_count)
    }

    pub fn cancel_proposal(env: Env, proposer: Address, proposal_id: u64) -> Result<(), Error> {
        proposer.require_auth();
        let config = read_config(&env);
        ensure_owner(&config, &proposer)?;
        let proposal_key = DataKey::Proposal(proposal_id);
        let mut proposal = read_proposal_by_key(&env, &proposal_key)?;
        if proposal.proposer != proposer {
            return Err(Error::NotProposer);
        }
        ensure_pending_and_active(&env, &proposal)?;
        if proposal.approval_count >= config.threshold {
            return Err(Error::ThresholdAlreadyReached);
        }
        proposal.status = ProposalStatus::Cancelled;
        env.storage().persistent().set(&proposal_key, &proposal);
        bump_proposal_ttl(&env, &proposal_key);
        ProposalCancelled {
            proposal_id,
            proposer,
        }
        .publish(&env);
        Ok(())
    }

    pub fn execute(env: Env, executor: Address, proposal_id: u64) -> Result<(), Error> {
        executor.require_auth();
        let config = read_config(&env);
        ensure_owner(&config, &executor)?;
        let proposal_key = DataKey::Proposal(proposal_id);
        let mut proposal = read_proposal_by_key(&env, &proposal_key)?;
        ensure_pending_and_active(&env, &proposal)?;
        if proposal.approval_count < config.threshold {
            return Err(Error::NotEnoughApprovals);
        }
        let token = token::TokenClient::new(&env, &config.token);
        let treasury = env.current_contract_address();
        if token.balance(&treasury) < proposal.amount {
            return Err(Error::InsufficientTreasuryBalance);
        }

        // Checks-effects-interactions. A failed cross-contract transfer traps and
        // Soroban rolls this write back atomically.
        proposal.status = ProposalStatus::Executed;
        env.storage().persistent().set(&proposal_key, &proposal);
        token.transfer(&treasury, &proposal.recipient, &proposal.amount);
        bump_proposal_ttl(&env, &proposal_key);
        ProposalExecuted {
            proposal_id,
            executor,
            recipient: proposal.recipient,
            amount: proposal.amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_config(env: Env) -> Config {
        read_config(&env)
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Result<Proposal, Error> {
        read_proposal_by_key(&env, &DataKey::Proposal(proposal_id))
    }

    pub fn has_approved(env: Env, proposal_id: u64, owner: Address) -> Result<bool, Error> {
        read_proposal_by_key(&env, &DataKey::Proposal(proposal_id))?;
        Ok(env
            .storage()
            .persistent()
            .has(&DataKey::Approval(proposal_id, owner)))
    }

    pub fn get_proposal_count(env: Env) -> u64 {
        read_config(&env).next_proposal_id
    }

    pub fn treasury_balance(env: Env) -> i128 {
        let config = read_config(&env);
        token::TokenClient::new(&env, &config.token).balance(&env.current_contract_address())
    }

    pub fn is_owner(env: Env, address: Address) -> bool {
        is_owner_in(&read_config(&env), &address)
    }

    pub fn is_expired(env: Env, proposal_id: u64) -> Result<bool, Error> {
        let proposal = read_proposal_by_key(&env, &DataKey::Proposal(proposal_id))?;
        Ok(env.ledger().sequence() >= proposal.expires_at_ledger)
    }

    pub fn is_executable(env: Env, proposal_id: u64) -> Result<bool, Error> {
        let config = read_config(&env);
        let proposal = read_proposal_by_key(&env, &DataKey::Proposal(proposal_id))?;
        Ok(proposal.status == ProposalStatus::Pending
            && env.ledger().sequence() < proposal.expires_at_ledger
            && proposal.approval_count >= config.threshold
            && token::TokenClient::new(&env, &config.token)
                .balance(&env.current_contract_address())
                >= proposal.amount)
    }
}

fn validate_owners(owners: &Vec<Address>) -> Result<(), Error> {
    if owners.is_empty() {
        return Err(Error::NoOwners);
    }
    if owners.len() > MAX_OWNERS {
        return Err(Error::TooManyOwners);
    }
    for i in 0..owners.len() {
        let current = owners.get(i).unwrap();
        for j in (i + 1)..owners.len() {
            if current == owners.get(j).unwrap() {
                return Err(Error::DuplicateOwner);
            }
        }
    }
    Ok(())
}

fn read_config(env: &Env) -> Config {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .expect("contract configuration is initialized")
}

fn read_proposal_by_key(env: &Env, key: &DataKey) -> Result<Proposal, Error> {
    env.storage()
        .persistent()
        .get(key)
        .ok_or(Error::ProposalNotFound)
}

fn is_owner_in(config: &Config, address: &Address) -> bool {
    config.owners.iter().any(|owner| owner == *address)
}

fn ensure_owner(config: &Config, address: &Address) -> Result<(), Error> {
    if is_owner_in(config, address) {
        Ok(())
    } else {
        Err(Error::NotOwner)
    }
}

fn ensure_pending_and_active(env: &Env, proposal: &Proposal) -> Result<(), Error> {
    if proposal.status != ProposalStatus::Pending {
        return Err(Error::ProposalNotPending);
    }
    if env.ledger().sequence() >= proposal.expires_at_ledger {
        return Err(Error::ProposalExpired);
    }
    Ok(())
}

fn bump_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn bump_proposal_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, ENTRY_TTL_THRESHOLD, ENTRY_TTL_EXTEND_TO);
}

fn bump_approval_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, ENTRY_TTL_THRESHOLD, ENTRY_TTL_EXTEND_TO);
}

fn panic_error(env: &Env, error: Error) -> ! {
    soroban_sdk::panic_with_error!(env, error)
}

#[cfg(test)]
mod test;
