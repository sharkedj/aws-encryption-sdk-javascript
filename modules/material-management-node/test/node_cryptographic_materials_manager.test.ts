/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use
 * this file except in compliance with the License. A copy of the License is
 * located at
 *
 *     http://aws.amazon.com/apache2.0/
 *
 * or in the "license" file accompanying this file. This file is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
 * implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-env mocha */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { KeyringNode } from '@aws-crypto/material-management'
import { NodeDefaultCryptographicMaterialsManager } from '../src/node_cryptographic_materials_manager'
import {
  NodeEncryptionMaterial, // eslint-disable-line no-unused-vars
  NodeDecryptionMaterial, // eslint-disable-line no-unused-vars
  NodeAlgorithmSuite,
  AlgorithmSuiteIdentifier,
  KeyringTraceFlag,
  EncryptedDataKey
} from '../src/index'
import { ENCODED_SIGNER_KEY } from '@aws-crypto/serialize'
chai.use(chaiAsPromised)
const { expect } = chai

describe('NodeDefaultCryptographicMaterialsManager', () => {
  it('constructor sets keyring', () => {
    class TestKeyring extends KeyringNode {
      async _onEncrypt (): Promise<NodeEncryptionMaterial> {
        throw new Error('never')
      }
      async _onDecrypt (): Promise<NodeDecryptionMaterial> {
        throw new Error('never')
      }
    }
    const keyring = new TestKeyring()
    const test = new NodeDefaultCryptographicMaterialsManager(keyring)
    expect(test).to.be.instanceOf(NodeDefaultCryptographicMaterialsManager)
    expect(test).to.haveOwnPropertyDescriptor('keyring', {
      value: keyring,
      writable: false,
      enumerable: true,
      configurable: false
    })
  })

  it('Precondition: keyrings must be a KeyringNode.', () => {
    expect(() => new NodeDefaultCryptographicMaterialsManager({} as any)).to.throw()
  })

  it('should create a signature key and append it to context', async () => {
    class TestKeyring extends KeyringNode {
      async _onEncrypt (): Promise<NodeEncryptionMaterial> {
        throw new Error('never')
      }
      async _onDecrypt (): Promise<NodeDecryptionMaterial> {
        throw new Error('never')
      }
    }
    const keyring = new TestKeyring()
    const cmm = new NodeDefaultCryptographicMaterialsManager(keyring)

    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16_HKDF_SHA256_ECDSA_P256)
    const material = new NodeEncryptionMaterial(suite)
    const context = { some: 'context' }
    const test = await cmm._generateSigningKeyAndUpdateEncryptionContext(material, context)
    expect(Object.keys(test)).lengthOf(2)
    expect(Object.isFrozen(test)).to.equal(true)
    expect(Object.isFrozen(context)).to.equal(false)
    expect(test).to.have.ownProperty('some').and.to.equal('context')
    expect(test).to.have.ownProperty(ENCODED_SIGNER_KEY)
  })

  it('Check for early return (Postcondition): The algorithm suite specification must support a signatureCurve to generate a ECDH key.', async () => {
    class TestKeyring extends KeyringNode {
      async _onEncrypt (): Promise<NodeEncryptionMaterial> {
        throw new Error('never')
      }
      async _onDecrypt (): Promise<NodeDecryptionMaterial> {
        throw new Error('never')
      }
    }
    const keyring = new TestKeyring()
    const cmm = new NodeDefaultCryptographicMaterialsManager(keyring)

    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16)
    const material = new NodeEncryptionMaterial(suite)
    const context = { some: 'context' }
    const test = await cmm._generateSigningKeyAndUpdateEncryptionContext(material, context)
    expect(Object.keys(test)).lengthOf(1)
    expect(Object.isFrozen(test)).to.equal(true)
    expect(Object.isFrozen(context)).to.equal(false)
    expect(test).to.have.ownProperty('some').and.to.equal('context')
  })

  it('Set the verification key.', async () => {
    class TestKeyring extends KeyringNode {
      async _onEncrypt (): Promise<NodeEncryptionMaterial> {
        throw new Error('never')
      }
      async _onDecrypt (): Promise<NodeDecryptionMaterial> {
        throw new Error('never')
      }
    }
    const keyring = new TestKeyring()
    const cmm = new NodeDefaultCryptographicMaterialsManager(keyring)

    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16_HKDF_SHA256_ECDSA_P256)

    const context = await cmm._generateSigningKeyAndUpdateEncryptionContext(
      new NodeEncryptionMaterial(suite),
      { some: 'context' }
    )

    const material = await cmm._loadVerificationKeyFromEncryptionContext(
      new NodeDecryptionMaterial(suite),
      context
    )
    expect(material.verificationKey).to.have.ownProperty('publicKey')
  })

  it('Check for early return (Postcondition): The algorithm suite specification must support a signatureCurve to load a signature key.', async () => {
    class TestKeyring extends KeyringNode {
      async _onEncrypt (): Promise<NodeEncryptionMaterial> {
        throw new Error('never')
      }
      async _onDecrypt (): Promise<NodeDecryptionMaterial> {
        throw new Error('never')
      }
    }
    const keyring = new TestKeyring()
    const cmm = new NodeDefaultCryptographicMaterialsManager(keyring)

    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16)
    const material = new NodeDecryptionMaterial(suite)
    const context = { some: 'context' }
    const test = await cmm._loadVerificationKeyFromEncryptionContext(material, context)
    expect(test === material).to.equal(true)
  })

  it('Precondition: NodeDefaultCryptographicMaterialsManager If the algorithm suite specification requires a signatureCurve a context must exist.', async () => {
    class TestKeyring extends KeyringNode {
      async _onEncrypt (): Promise<NodeEncryptionMaterial> {
        throw new Error('never')
      }
      async _onDecrypt (): Promise<NodeDecryptionMaterial> {
        throw new Error('never')
      }
    }
    const keyring = new TestKeyring()
    const cmm = new NodeDefaultCryptographicMaterialsManager(keyring)
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16_HKDF_SHA256_ECDSA_P256)

    await expect(cmm._loadVerificationKeyFromEncryptionContext(
      new NodeDecryptionMaterial(suite)
    )).to.rejectedWith(Error)
  })

  it('Precondition: NodeDefaultCryptographicMaterialsManager The context must contain the public key.', async () => {
    class TestKeyring extends KeyringNode {
      async _onEncrypt (): Promise<NodeEncryptionMaterial> {
        throw new Error('never')
      }
      async _onDecrypt (): Promise<NodeDecryptionMaterial> {
        throw new Error('never')
      }
    }
    const keyring = new TestKeyring()
    const cmm = new NodeDefaultCryptographicMaterialsManager(keyring)
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16_HKDF_SHA256_ECDSA_P256)

    await expect(cmm._loadVerificationKeyFromEncryptionContext(
      new NodeDecryptionMaterial(suite),
      { no: 'signature' }
    )).to.rejectedWith(Error)
  })

  it('Postcondition: The NodeEncryptionMaterial must contain a valid dataKey.', async () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16_HKDF_SHA256_ECDSA_P256)

    class TestKeyring extends KeyringNode {
      async _onEncrypt (material: NodeEncryptionMaterial): Promise<NodeEncryptionMaterial> {
        return material
      }
      async _onDecrypt (): Promise<NodeDecryptionMaterial> {
        throw new Error('never')
      }
    }
    const keyring = new TestKeyring()
    const cmm = new NodeDefaultCryptographicMaterialsManager(keyring)

    await expect(cmm.getEncryptionMaterials({ suite })).to.rejectedWith(Error)
  })

  it('Postcondition: The NodeEncryptionMaterial must contain at least 1 EncryptedDataKey.', async () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16_HKDF_SHA256_ECDSA_P256)

    class TestKeyring extends KeyringNode {
      async _onEncrypt (material: NodeEncryptionMaterial): Promise<NodeEncryptionMaterial> {
        const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
        const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_GENERATED_DATA_KEY }
        return material.setUnencryptedDataKey(dataKey, trace)
      }
      async _onDecrypt (): Promise<NodeDecryptionMaterial> {
        throw new Error('never')
      }
    }
    const keyring = new TestKeyring()
    const cmm = new NodeDefaultCryptographicMaterialsManager(keyring)

    await expect(cmm.getEncryptionMaterials({ suite })).to.rejectedWith(Error)
  })

  it('Postcondition: The NodeDecryptionMaterial must contain a valid dataKey.', async () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16)

    class TestKeyring extends KeyringNode {
      async _onEncrypt (): Promise<NodeEncryptionMaterial> {
        throw new Error('never')
      }
      async _onDecrypt (material: NodeDecryptionMaterial): Promise<NodeDecryptionMaterial> {
        return material
      }
    }
    const keyring = new TestKeyring()
    const cmm = new NodeDefaultCryptographicMaterialsManager(keyring)
    const encryptedDataKeys = [new EncryptedDataKey({
      providerId: 'p', providerInfo: 'p', encryptedDataKey: new Uint8Array(5)
    })]

    await expect(cmm.decryptMaterials({ suite, encryptedDataKeys })).to.rejectedWith(Error)
  })

  it('Return decryption material', async () => {
    const suite = new NodeAlgorithmSuite(AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16)

    class TestKeyring extends KeyringNode {
      async _onEncrypt (): Promise<NodeEncryptionMaterial> {
        throw new Error('never')
      }
      async _onDecrypt (material: NodeDecryptionMaterial): Promise<NodeDecryptionMaterial> {
        const dataKey = new Uint8Array(suite.keyLengthBytes).fill(1)
        const trace = { keyNamespace: 'k', keyName: 'k', flags: KeyringTraceFlag.WRAPPING_KEY_DECRYPTED_DATA_KEY }
        return material.setUnencryptedDataKey(dataKey, trace)
      }
    }
    const keyring = new TestKeyring()
    const cmm = new NodeDefaultCryptographicMaterialsManager(keyring)
    const encryptedDataKeys = [new EncryptedDataKey({
      providerId: 'p', providerInfo: 'p', encryptedDataKey: new Uint8Array(5)
    })]

    const { material } = await cmm.decryptMaterials({ suite, encryptedDataKeys })
    expect(material.hasUnencryptedDataKey).to.equal(true)
  })
})
