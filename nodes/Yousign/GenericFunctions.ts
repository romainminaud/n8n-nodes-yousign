import { OptionsWithUri } from 'request';

import {
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
} from 'n8n-core';

import { IDataObject, JsonObject, NodeApiError } from 'n8n-workflow';

export async function yousignApiRequest(
	this: IHookFunctions | IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions,
	sandbox: boolean,
	method: string,
	endpoint: string,
	body?: IDataObject,
	formData?: IDataObject,
	// tslint:disable-next-line:no-any
): Promise<any> {
	const options: OptionsWithUri = {
		method,
		headers: {
			Accept: 'application/json',
		},
		uri: sandbox
			? `https://api-sandbox.yousign.app/v3/${endpoint}`
			: `https://api.yousign.app/v3/${endpoint}`,
		body,
		formData,
		json: true,
	};

	try {
		return await this.helpers.requestWithAuthentication.call(this, 'yousignApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
