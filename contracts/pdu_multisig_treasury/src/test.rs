#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, vec, Address, Env, String,
};

struct Fixture {
    env: Env,
    client: PduMultisigTreasuryClient<'static>,
    token: token::TokenClient<'static>,
    token_admin: token::StellarAssetClient<'static>,
    alice: Address,
    bob: Address,
    carol: Address,
    david: Address,
}

fn fixture() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|ledger| {
        ledger.sequence_number = 1_000;
        ledger.timestamp = 1_780_000_000;
    });
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);
    let david = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token_address = sac.address();
    let token = token::TokenClient::new(&env, &token_address);
    let token_admin = token::StellarAssetClient::new(&env, &token_address);
    let owners = vec![&env, alice.clone(), bob.clone(), carol.clone()];
    let contract_id = env.register(PduMultisigTreasury, (owners, 3_u32, token_address.clone()));
    let client = PduMultisigTreasuryClient::new(&env, &contract_id);
    Fixture {
        env,
        client,
        token,
        token_admin,
        alice,
        bob,
        carol,
        david,
    }
}

#[test]
fn constructor_sets_immutable_configuration() {
    let f = fixture();
    let config = f.client.get_config();
    assert_eq!(config.threshold, 3);
    assert_eq!(config.owners.len(), 3);
    assert_eq!(config.next_proposal_id, 0);
    assert!(f.client.is_owner(&f.alice));
    assert!(!f.client.is_owner(&f.david));
}

#[test]
#[should_panic]
fn constructor_rejects_duplicate_owner() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let token = Address::generate(&env);
    env.register(
        PduMultisigTreasury,
        (vec![&env, owner.clone(), owner], 1_u32, token),
    );
}

#[test]
#[should_panic]
fn constructor_rejects_non_unanimous_threshold() {
    let env = Env::default();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);
    let token = Address::generate(&env);
    env.register(
        PduMultisigTreasury,
        (vec![&env, alice, bob, carol], 2_u32, token),
    );
}

#[test]
fn deposit_uses_real_sac_balance() {
    let f = fixture();
    f.token_admin.mint(&f.alice, &50_000_000);
    let balance = f.client.deposit(&f.alice, &25_000_000);
    assert_eq!(balance, 25_000_000);
    assert_eq!(f.client.treasury_balance(), 25_000_000);
    assert_eq!(f.token.balance(&f.alice), 25_000_000);
}

#[test]
fn deposit_rejects_non_positive_amount() {
    let f = fixture();
    assert_eq!(
        f.client.try_deposit(&f.alice, &0),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn proposal_creation_auto_approves_proposer_and_counts_utf8_bytes() {
    let f = fixture();
    let expires = f.env.ledger().sequence() + 100;
    let memo = String::from_str(&f.env, "Thanh toan CLB lap trinh");
    let id = f
        .client
        .create_proposal(&f.alice, &f.david, &10_000_000, &memo, &expires);
    let proposal = f.client.get_proposal(&id);
    assert_eq!(id, 0);
    assert_eq!(proposal.approval_count, 1);
    assert_eq!(proposal.status, ProposalStatus::Pending);
    assert!(f.client.has_approved(&id, &f.alice));
    assert_eq!(f.client.get_proposal_count(), 1);
}

#[test]
fn proposal_rejects_161_byte_memo() {
    let f = fixture();
    let memo = String::from_bytes(&f.env, &[b'a'; 161]);
    let expires = f.env.ledger().sequence() + 100;
    assert_eq!(
        f.client
            .try_create_proposal(&f.alice, &f.david, &1, &memo, &expires),
        Err(Ok(Error::MemoTooLong))
    );
}

#[test]
fn all_three_owners_must_approve_and_duplicates_are_rejected() {
    let f = fixture();
    f.token_admin.mint(&f.alice, &20_000_000);
    f.client.deposit(&f.alice, &20_000_000);
    let expires = f.env.ledger().sequence() + 100;
    let id = f.client.create_proposal(
        &f.alice,
        &f.david,
        &10_000_000,
        &String::from_str(&f.env, "Hoc bong hackathon"),
        &expires,
    );
    assert_eq!(f.client.approve(&f.bob, &id), 2);
    assert!(!f.client.is_executable(&id));
    assert_eq!(
        f.client.try_approve(&f.bob, &id),
        Err(Ok(Error::AlreadyApproved))
    );
    assert_eq!(f.client.approve(&f.carol, &id), 3);
    assert!(f.client.is_executable(&id));
}

#[test]
fn cancel_only_before_threshold_and_by_proposer() {
    let f = fixture();
    let expires = f.env.ledger().sequence() + 100;
    let id = f.client.create_proposal(
        &f.alice,
        &f.david,
        &1,
        &String::from_str(&f.env, "Chi phi workshop"),
        &expires,
    );
    assert_eq!(
        f.client.try_cancel_proposal(&f.bob, &id),
        Err(Ok(Error::NotProposer))
    );
    f.client.cancel_proposal(&f.alice, &id);
    assert_eq!(f.client.get_proposal(&id).status, ProposalStatus::Cancelled);
}

#[test]
fn execute_transfers_once_after_threshold() {
    let f = fixture();
    f.token_admin.mint(&f.alice, &100_000_000);
    f.client.deposit(&f.alice, &100_000_000);
    let expires = f.env.ledger().sequence() + 100;
    let id = f.client.create_proposal(
        &f.alice,
        &f.david,
        &30_000_000,
        &String::from_str(&f.env, "Tai tro su kien sinh vien"),
        &expires,
    );
    assert_eq!(
        f.client.try_execute(&f.alice, &id),
        Err(Ok(Error::NotEnoughApprovals))
    );
    f.client.approve(&f.bob, &id);
    assert_eq!(
        f.client.try_execute(&f.alice, &id),
        Err(Ok(Error::NotEnoughApprovals))
    );
    f.client.approve(&f.carol, &id);
    assert!(f.client.is_executable(&id));
    f.client.execute(&f.alice, &id);
    assert_eq!(f.token.balance(&f.david), 30_000_000);
    assert_eq!(f.client.treasury_balance(), 70_000_000);
    assert_eq!(f.client.get_proposal(&id).status, ProposalStatus::Executed);
    assert_eq!(
        f.client.try_execute(&f.carol, &id),
        Err(Ok(Error::ProposalNotPending))
    );
}

#[test]
fn expired_proposal_cannot_be_approved_or_executed() {
    let f = fixture();
    let expires = f.env.ledger().sequence() + 2;
    let id = f.client.create_proposal(
        &f.alice,
        &f.david,
        &1,
        &String::from_str(&f.env, "Het han"),
        &expires,
    );
    f.env
        .ledger()
        .with_mut(|ledger| ledger.sequence_number = expires);
    assert!(f.client.is_expired(&id));
    assert_eq!(
        f.client.try_approve(&f.bob, &id),
        Err(Ok(Error::ProposalExpired))
    );
}

#[test]
fn insufficient_balance_does_not_change_status() {
    let f = fixture();
    let expires = f.env.ledger().sequence() + 100;
    let id = f.client.create_proposal(
        &f.alice,
        &f.david,
        &99_000_000,
        &String::from_str(&f.env, "Khong du quy"),
        &expires,
    );
    f.client.approve(&f.bob, &id);
    f.client.approve(&f.carol, &id);
    assert_eq!(
        f.client.try_execute(&f.carol, &id),
        Err(Ok(Error::InsufficientTreasuryBalance))
    );
    assert_eq!(f.client.get_proposal(&id).status, ProposalStatus::Pending);
}
