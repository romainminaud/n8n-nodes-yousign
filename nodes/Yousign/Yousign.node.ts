import { IExecuteFunctions } from 'n8n-core';

import {
	IBinaryData,
	IBinaryKeyData,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { Signer, SignerRaw, SignersUiValues } from './utils/types';

import { yousignApiRequest } from './GenericFunctions';

export class Yousign implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yousign',
		name: 'Yousign',
		icon: 'file:yousign.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Generate signature request.',
		defaults: {
			name: 'Yousign',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'yousignApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Signature Request',
						value: 'signatureRequest',
					},
				],
				default: 'signatureRequest',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['signatureRequest'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create signature request',
						description: 'Create a new signature request',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Sandbox',
				name: 'sandbox',
				type: 'boolean',
				default: true,
				description: 'Whether to use the Sandbox or not',
				displayOptions: {
					show: {
						resource: ['signatureRequest'],
					},
				},
			},
			{
				displayName: 'Signature Request Name',
				name: 'name',
				type: 'string',
				required: true,
				default: 'A Signature Request',
				description: 'The name of the Signature Request',
				displayOptions: {
					show: {
						resource: ['signatureRequest'],
					},
				},
			},
			{
				displayName: 'Signers',
				name: 'signersUi',
				placeholder: 'Add Signer',
				required: true,
				type: 'fixedCollection',
				default: {},
				typeOptions: {
					multipleValues: true,
				},
				description: 'Signers for this signature request',
				options: [
					{
						name: 'signers',
						displayName: 'Signers',
						values: [
							{
								displayName: 'Signer First Name',
								name: 'firstName',
								type: 'string',
								required: true,
								default: 'John',
								description: 'First name of the signer',
							},
							{
								displayName: 'Signer Last Name',
								name: 'lastName',
								type: 'string',
								required: true,
								default: 'Doe',
								description: 'Last name of the signer',
							},
							{
								displayName: 'Signer Email',
								name: 'email',
								type: 'string',
								placeholder: 'name@email.com',
								required: true,
								default: 'john.doe@acme.com',
								description: 'Must be a valid email',
							},
						],
					},
				],
				displayOptions: {
					show: {},
				},
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						resource: ['signatureRequest'],
					},
				},
				placeholder: '',
				description:
					'Name of the binary property which contains the data for the file to be uploaded',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Handle data coming from previous nodes
		const items = this.getInputData();
		let responseDataRequest;
		const returnData = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// For each item, make an API
		for (let i = 0; i < items.length; i++) {
			if (resource === 'signatureRequest') {
				if (operation === 'create') {
					// const firstName = this.getNodeParameter('firstName', i) as string;
					// const lastName = this.getNodeParameter('lastName', i) as string;
					// const email = this.getNodeParameter('email', i) as string;

					const sandbox = this.getNodeParameter('sandbox', i) as boolean;
					const name = this.getNodeParameter('name', i) as string;
					const signers = this.getNodeParameter('signersUi.signers', i) as SignersUiValues;

					if (items[i].binary === undefined) {
						throw new NodeOperationError(this.getNode(), 'No binary data exists on item!', {
							itemIndex: i,
						});
					}

					const propertyNameUpload = this.getNodeParameter('binaryPropertyName', i) as string;

					// Manage Binary File

					if (items[i]!.binary![propertyNameUpload] === undefined) {
						throw new NodeOperationError(
							this.getNode(),
							`No binary data property "${propertyNameUpload}" does not exists on item!`,
							{ itemIndex: i },
						);
					}

					const item = items[i].binary as IBinaryKeyData;
					const binaryData = item[propertyNameUpload] as IBinaryData;
					const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, propertyNameUpload);

					// Upload documents

					const formData = {
						file: {
							value: binaryDataBuffer,
							options: {
								filename: binaryData.fileName,
								contentType: binaryData.mimeType,
							},
						},
						nature: 'signable_document',
						parse_anchors: 'true',
					};

					const { id: documentId } = await yousignApiRequest.call(
						this,
						sandbox,
						'POST',
						'/documents',
						undefined,
						formData,
					);

					const signersEnriched = signers.map((signer: SignerRaw) => {
						return {
							info: {
								first_name: signer.firstName,
								last_name: signer.lastName,
								email: signer.email,
								// phone_number: '+33700000000',
								locale: 'fr',
							},
							signature_level: 'electronic_signature',
							signature_authentication_mode: 'no_otp',
						};
					}) as Signer[];

					const body = {
						name,
						delivery_mode: 'email',
						timezone: 'Europe/Paris',
						documents: [documentId],
						signers: signersEnriched,
					};

					// Create Signature Request

					const { id: signatureRequestId } = await yousignApiRequest.call(
						this,
						sandbox,
						'POST',
						'/signature_requests',
						body,
					);

					// Activate Signature Request

					responseDataRequest = await yousignApiRequest.call(
						this,
						sandbox,
						'POST',
						`/signature_requests/${signatureRequestId}/activate`,
					);

					returnData.push(responseDataRequest);
				}
			}
		}

		// Map data to n8n data structure
		return [this.helpers.returnJsonArray(returnData)];
	}
}
