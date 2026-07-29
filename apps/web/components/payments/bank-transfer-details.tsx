'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export type PaymentInstruction = {
  title: string;
  instructions: string;
  accountData?: {
    clabe?: string;
    beneficiary?: string;
    institution?: string;
    dimoPhone?: string;
  } | null;
};

export function BankTransferDetails({
  instruction,
}: {
  instruction: PaymentInstruction;
}) {
  const [copied, setCopied] = useState(false);
  const account = instruction.accountData;

  async function copyClabe() {
    if (!account?.clabe) return;
    await navigator.clipboard.writeText(account.clabe);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="bankTransferDetails">
      <p>{instruction.instructions}</p>
      {account && (
        <dl>
          {account.clabe && (
            <div>
              <dt>CLABE</dt>
              <dd>
                <strong>{account.clabe}</strong>
                <button
                  aria-label="Copiar CLABE"
                  onClick={copyClabe}
                  title="Copiar CLABE"
                  type="button"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </dd>
            </div>
          )}
          {account.beneficiary && (
            <div>
              <dt>Beneficiaria</dt>
              <dd>{account.beneficiary}</dd>
            </div>
          )}
          {account.institution && (
            <div>
              <dt>Institución</dt>
              <dd>{account.institution}</dd>
            </div>
          )}
          {account.dimoPhone && (
            <div>
              <dt>Celular Dimo</dt>
              <dd>{account.dimoPhone}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
