export type SignerRaw = {
	firstName: string;
	lastName: string;
	email: string;
};

export type SignersUiValues = Array<SignerRaw>;

export type Signer = {
	info: {
		first_name: string;
		last_name: string;
		email: string;
	};
	signature_level: string;
	signature_authentication_mode: string;
};
