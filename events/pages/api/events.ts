import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next'
import initMiddleware from '../../lib/init-middleware'
import validateMiddleware from '../../lib/validate-middleware'
import { check, validationResult } from 'express-validator'

const validateBody = initMiddleware(
  validateMiddleware([
      check('context.tx_idx').isInt({ min: 0, max: 255}),
      check('context.tx_hash').isBase64(),
  ], validationResult)
)

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse ) {

        const network = process.env.NEXT_PUBLIC_NETWORK as string;
        const eventAPIKey = process.env.NEXT_PUBLIC_EVENT_API_KEY as string;

        if (req.method == 'POST') {
    
            // Check for basic auth header
            if (!req.headers.authorization || req.headers.authorization.indexOf('Basic ') === -1) {
                throw { status: 401, message: 'Missing Authorization Header' };
            }

            // Verify auth credentials
            const apiKey = req.headers.authorization.split(' ')[1];
            if (eventAPIKey != apiKey) {
                throw { status: 401, message: 'Invalid Authentication Credentials' };
            }
            
            // Sanitize body inputs
            await validateBody(req, res)

            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(422).json({ errors: errors.array() })
            }

            const txId = req.body.context.tx_hash + ` ` + req.body.context.tx_idx;
            const shell = require('shelljs');
            const scriptsDirectory = path.join(process.cwd(), 'scripts/cardano-cli');
            const cmd = `(cd ` + scriptsDirectory + `; ./spend-tx.sh ` + network + ` ` + txId + `)`;

            if (shell.exec(cmd).code !== 0) {
                res.setHeader('Tx-Status', 'Tx Failed');
                res.status(500).json(`Tx Failed: ` + txId );
            } else {
                res.setHeader('Tx-Status', 'Tx Submitted');
                res.status(200).json(`Tx Submitted: ` + txId);
            }

          }
          else {
              res.status(400);
              res.send(`Invalid API Request`);
          }

}