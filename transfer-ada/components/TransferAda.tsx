import { useState } from 'react'

const TransferAda = ({ onTransferAda } : any) => {

    const [address, setAddress] = useState('')
    const [qty, setQty] = useState('')

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onTransferAda([address, qty])
    }
    

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Destination Wallet Address</b> 
                <br></br>
                <input name='address' type='text' id='address' placeholder='Enter User Wallet Address' 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
                <b>Amount To Transfer</b> 
                <br></br>
                <input name='qty' type='number' id='qty' placeholder='Enter Amount Of Ada To Transfer' 
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                />
            </div>
            <br></br>                   
            <input type='submit' value='Transfer Ada'/>
        </form>
    )
}

export default TransferAda