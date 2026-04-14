Project personal_finance_wallets {
  database_type: "PostgreSQL"
  Note: '''
  Sistema financeiro baseado em carteiras com:
  - autenticação por email + OTP
  - múltiplas carteiras por usuário
  - compartilhamento de carteira com permissões
  - transações por carteira
  - transferências com lastro entre carteiras
  - cartões de crédito
  - faturas
  - compras parceladas
  '''
}

Enum user_status {
  active
  inactive
  blocked
}

Enum wallet_type {
  personal
  home
  business
  family
  project
  custom
}

Enum wallet_member_role {
  owner
  editor
  viewer
}

Enum wallet_member_status {
  invited
  active
  revoked
}

Enum transaction_type {
  income
  expense
  transfer_in
  transfer_out
  credit_card_purchase
  invoice_payment
}

Enum transaction_status {
  pending
  paid
  canceled
}

Enum credit_card_invoice_status {
  open
  closed
  paid
  overdue
}

Enum installment_entry_status {
  pending
  billed
  paid
  canceled
}

Enum payment_method_type {
  cash
  bank_account
  pix
  debit_card
  credit_card
  boleto
  internal_transfer
  other
}

Table users {
  id uuid [pk]
  email varchar(255) [not null, unique]
  status user_status [not null, default: 'active']
  last_login_at timestamptz
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table user_otps {
  id uuid [pk]
  user_id uuid [ref: > users.id]
  email varchar(255) [not null]
  token_hash varchar(255) [not null]
  expires_at timestamptz [not null]
  used_at timestamptz
  attempts int [not null, default: 0]
  created_at timestamptz [not null]

  Indexes {
    email
    user_id
    expires_at
  }
}

Table auth_sessions {
  id uuid [pk]
  user_id uuid [not null, ref: > users.id]
  token_hash varchar(255) [not null]
  expires_at timestamptz [not null]
  last_seen_at timestamptz
  ip varchar(128)
  user_agent varchar(500)
  created_at timestamptz [not null]

  Indexes {
    user_id
    expires_at
  }
}

Table wallets {
  id uuid [pk]
  owner_user_id uuid [not null, ref: > users.id]
  name varchar(150) [not null]
  type wallet_type [not null, default: 'personal']
  currency_code varchar(10) [not null, default: 'BRL']
  initial_balance numeric(14,2) [not null, default: 0]
  description text
  is_archived boolean [not null, default: false]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    owner_user_id
    is_archived
  }
}

Table wallet_members {
  id uuid [pk]
  wallet_id uuid [not null, ref: > wallets.id]
  user_id uuid [not null, ref: > users.id]
  role wallet_member_role [not null]
  status wallet_member_status [not null, default: 'active']
  invited_by_user_id uuid [ref: > users.id]
  invited_at timestamptz
  revoked_at timestamptz
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    (wallet_id, user_id) [unique]
    wallet_id
    user_id
    status
  }
}

Table categories {
  id uuid [pk]
  wallet_id uuid [ref: > wallets.id]
  parent_id uuid [ref: > categories.id]
  type transaction_type [not null]
  name varchar(120) [not null]
  is_system boolean [not null, default: false]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    wallet_id
    parent_id
    (wallet_id, name)
  }
}

Table bank_accounts {
  id uuid [pk]
  wallet_id uuid [not null, ref: > wallets.id]
  name varchar(150) [not null]
  bank_name varchar(150)
  account_type varchar(50)
  initial_balance numeric(14,2) [not null, default: 0]
  is_archived boolean [not null, default: false]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    wallet_id
    is_archived
  }
}

Table credit_cards {
  id uuid [pk]
  wallet_id uuid [not null, ref: > wallets.id]
  name varchar(150) [not null]
  issuer varchar(150)
  brand varchar(50)
  last_four varchar(4)
  credit_limit numeric(14,2)
  closing_day int [not null]
  due_day int [not null]
  is_archived boolean [not null, default: false]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    wallet_id
    is_archived
  }
}

Table credit_card_invoices {
  id uuid [pk]
  credit_card_id uuid [not null, ref: > credit_cards.id]
  billing_year int [not null]
  billing_month int [not null]
  closing_date date [not null]
  due_date date [not null]
  total_amount numeric(14,2) [not null, default: 0]
  paid_amount numeric(14,2) [not null, default: 0]
  outstanding_amount numeric(14,2) [not null, default: 0]
  status credit_card_invoice_status [not null, default: 'open']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    credit_card_id
    (credit_card_id, billing_year, billing_month) [unique]
    status
    due_date
  }
}

Table installment_plans {
  id uuid [pk]
  wallet_id uuid [not null, ref: > wallets.id]
  credit_card_id uuid [ref: > credit_cards.id]
  category_id uuid [ref: > categories.id]
  description varchar(255) [not null]
  total_amount numeric(14,2) [not null]
  installment_amount numeric(14,2) [not null]
  total_installments int [not null]
  start_date date [not null]
  purchase_date date [not null]
  created_by_user_id uuid [not null, ref: > users.id]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    wallet_id
    credit_card_id
    category_id
    created_by_user_id
  }
}

Table installment_entries {
  id uuid [pk]
  installment_plan_id uuid [not null, ref: > installment_plans.id]
  installment_number int [not null]
  billing_year int
  billing_month int
  due_date date
  amount numeric(14,2) [not null]
  status installment_entry_status [not null, default: 'pending']
  credit_card_invoice_id uuid [ref: > credit_card_invoices.id]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    installment_plan_id
    credit_card_invoice_id
    (installment_plan_id, installment_number) [unique]
    status
  }
}

Table transfers {
  id uuid [pk]
  origin_wallet_id uuid [not null, ref: > wallets.id]
  destination_wallet_id uuid [not null, ref: > wallets.id]
  origin_transaction_id uuid
  destination_transaction_id uuid
  amount numeric(14,2) [not null]
  description varchar(255) [not null]
  transfer_date date [not null]
  created_by_user_id uuid [not null, ref: > users.id]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    origin_wallet_id
    destination_wallet_id
    created_by_user_id
    transfer_date
  }
}

Table transactions {
  id uuid [pk]
  wallet_id uuid [not null, ref: > wallets.id]
  type transaction_type [not null]
  status transaction_status [not null, default: 'paid']
  description varchar(255) [not null]
  amount numeric(14,2) [not null]
  category_id uuid [ref: > categories.id]
  bank_account_id uuid [ref: > bank_accounts.id]
  credit_card_id uuid [ref: > credit_cards.id]
  credit_card_invoice_id uuid [ref: > credit_card_invoices.id]
  installment_plan_id uuid [ref: > installment_plans.id]
  installment_entry_id uuid [ref: > installment_entries.id]
  transfer_id uuid [ref: > transfers.id]
  payment_method payment_method_type
  transaction_date date [not null]
  due_date date
  notes text
  created_by_user_id uuid [not null, ref: > users.id]
  updated_by_user_id uuid [ref: > users.id]
  deleted_at timestamptz
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    wallet_id
    category_id
    bank_account_id
    credit_card_id
    credit_card_invoice_id
    installment_plan_id
    installment_entry_id
    transfer_id
    created_by_user_id
    transaction_date
    due_date
    type
    status
  }
}

Ref: transfers.origin_transaction_id > transactions.id
Ref: transfers.destination_transaction_id > transactions.id