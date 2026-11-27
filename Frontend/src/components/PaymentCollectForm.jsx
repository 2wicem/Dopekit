import { PAYMENT_METHODS } from '../constants/paymentMethods'

const PaymentCollectForm = ({
  method,
  amount,
  onMethodChange,
  onAmountChange,
  mpesaCode = '',
  onMpesaCodeChange,
  amountId = 'payment-amount',
  methodName = 'payment_method',
}) => (
  <div className="payment-collect-fields">
    <fieldset className="payment-collect-methods">
      <legend>How did they pay?</legend>
      <div className="payment-collect-options">
        {PAYMENT_METHODS.map((entry) => (
          <label key={entry.value} className="payment-collect-option">
            <input
              type="radio"
              name={methodName}
              value={entry.value}
              checked={method === entry.value}
              onChange={(event) => onMethodChange(event.target.value)}
            />
            {entry.label}
          </label>
        ))}
      </div>
    </fieldset>
    <div>
      <label htmlFor={amountId}>Amount (KES)</label>
      <input
        id={amountId}
        name="payment_amount_kes"
        type="number"
        min="0"
        inputMode="numeric"
        value={amount}
        onChange={(event) => onAmountChange(event.target.value)}
        placeholder="Same as service price if blank"
      />
    </div>
    {method === 'bank' && onMpesaCodeChange ? (
      <div>
        <label htmlFor={`${amountId}-mpesa`}>M-Pesa receipt code</label>
        <input
          id={`${amountId}-mpesa`}
          name="mpesa_code"
          value={mpesaCode}
          onChange={(event) => onMpesaCodeChange(event.target.value.toUpperCase())}
          placeholder="e.g. TGH7K2M91P"
          autoComplete="off"
          required
        />
      </div>
    ) : null}
  </div>
)

export default PaymentCollectForm
