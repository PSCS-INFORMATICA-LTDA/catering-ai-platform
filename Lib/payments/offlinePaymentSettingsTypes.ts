export type OfflinePaymentSettings = {
  zelle: {
    enabled: boolean;
    recipientName: string;
    recipientContact: string;
    instructions: string;
  };
  bankTransfer: {
    enabled: boolean;
    bankName: string;
    accountHolder: string;
    routingNumber: string;
    accountNumber: string;
    instructions: string;
    wireRoutingNumber?: string;
    paymentAddress?: string;
    checkPayableTo?: string;
  };
};
