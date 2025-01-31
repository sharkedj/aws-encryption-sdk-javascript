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

// @ts-ignore
import { Transform as PortableTransform } from 'readable-stream'
import { Transform } from 'stream' // eslint-disable-line no-unused-vars
import {
  NodeAlgorithmSuite,
  NodeMaterialsManager, // eslint-disable-line no-unused-vars
  getDecryptionHelper,
  needs
} from '@aws-crypto/material-management-node'
import { deserializeFactory, kdfInfo, ContentType } from '@aws-crypto/serialize'
import { VerifyInfo } from './verify_stream' // eslint-disable-line no-unused-vars

const toUtf8 = (input: Uint8Array) => Buffer
  .from(input.buffer, input.byteOffset, input.byteLength)
  .toString('utf8')
const deserialize = deserializeFactory(toUtf8, NodeAlgorithmSuite)
const PortableTransformWithType = (<new (...args: any[]) => Transform>PortableTransform)

interface HeaderState {
  buffer: Buffer
}

export interface ParseHeaderOptions {
  maxBodySize?: number
}

export class ParseHeaderStream extends PortableTransformWithType {
  private materialsManager!: NodeMaterialsManager
  private _headerState: HeaderState
  private _maxBodySize?: number
  constructor (cmm: NodeMaterialsManager, { maxBodySize }: ParseHeaderOptions = {}) {
    /* Precondition: MaxBodySize must be falsey or a number. */
    needs(!maxBodySize || typeof maxBodySize === 'number', 'Unsupported MaxBodySize.')
    super()
    Object.defineProperty(this, 'materialsManager', { value: cmm, enumerable: true })
    Object.defineProperty(this, '_maxBodySize', { value: maxBodySize, enumerable: true })
    this._headerState = {
      buffer: Buffer.alloc(0)
    }
  }

  _transform (chunk: any, encoding: string, callback: Function) {
    const { buffer } = this._headerState
    const headerBuffer = Buffer.concat([buffer, chunk])
    const headerInfo = deserialize.deserializeMessageHeader(headerBuffer)
    if (!headerInfo) {
      this._headerState.buffer = headerBuffer
      return callback()
    }

    const { messageHeader, algorithmSuite } = headerInfo
    const { rawHeader, headerIv, headerAuthTag } = headerInfo

    const suite = new NodeAlgorithmSuite(algorithmSuite.id)
    const { encryptionContext, encryptedDataKeys, contentType, frameLength } = messageHeader

    /* Framed messages store the frame size in the header.
     * It is easy to confirm here.
     * For non-framed messages, the size is in the body header.
     * The check in verify stream _should_ be adequate from a logical perspective.
     * However, doing this check here allows framed messages to exit before the CMM is called.
     * This means that decryption of the Encrypted Data Key is never even attempted.
     */
    if (contentType === ContentType.FRAMED_DATA) {
      /* Precondition: If maxBodySize was set I can not buffer a frame more data than maxBodySize.
       * Before returning *any* cleartext, the stream **MUST** verify the decryption.
       * This means that I must buffer the message until the AuthTag is reached.
       */
      needs(!this._maxBodySize || this._maxBodySize >= frameLength, 'maxBodySize exceeded.')
    }

    this.materialsManager
      .decryptMaterials({ suite, encryptionContext, encryptedDataKeys })
      .then(({ material }) => {
        this._headerState.buffer = Buffer.alloc(0) // clear the Buffer...

        const { kdfGetDecipher, getVerify, dispose } = getDecryptionHelper(material)

        const info = kdfInfo(messageHeader.suiteId, messageHeader.messageId)
        const getDecipher = kdfGetDecipher(info)
        const headerAuth = getDecipher(headerIv)

        headerAuth.setAAD(Buffer.from(rawHeader.buffer, rawHeader.byteOffset, rawHeader.byteLength))
        headerAuth.setAuthTag(Buffer.from(headerAuthTag.buffer, headerAuthTag.byteOffset, headerAuthTag.byteLength))
        headerAuth.update(Buffer.alloc(0))
        headerAuth.final() // will throw if invalid

        const verify = getVerify ? getVerify() : void 0
        const verifyInfo: VerifyInfo = { headerInfo, getDecipher, verify, dispose }
        this.emit('VerifyInfo', verifyInfo)
        this.emit('MessageHeader', headerInfo.messageHeader)

        // The header is parsed, pass control
        const readPos = rawHeader.byteLength + headerIv.byteLength + headerAuthTag.byteLength
        const tail = headerBuffer.slice(readPos)
        this._transform = (chunk: any, _enc: string, cb: Function) => cb(null, chunk)
        // flush the tail.  Stream control is now in the verify and decrypt streams
        return setImmediate(() => this._transform(tail, encoding, callback))
      })
      .catch(err => callback(err))
  }
}
