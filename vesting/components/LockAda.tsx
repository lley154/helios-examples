import { useState } from 'react'

const LockAda = ({ onLockAda } : any) => {

    const [address, setAddress] = useState('');
    const [qty, setQty] = useState('');
    const [dueDate, setDueDate] = useState('');

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onLockAda([address, qty, dueDate])
    }

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Benificary Wallet Address</b> 
                <br></br>
                <input name='address' type='text' id='address' placeholder='Enter Beneficiary Wallet Address' 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                />
                <p></p>                 
            </div>
            <div>
                <b>Amount Of Ada To Lock</b> 
                <br></br>
                <input name='qty' type='number' id='qty' placeholder='Enter Amount Of Ada To Lock' 
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                />
                <p></p>  
            </div>
            <div>
                <b>Vesting Expiry Date</b> 
                <br></br>
                <input name='dueDate' type='date' id='dueDate' placeholder='Select Vesting Expiry Date' 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                />
                <p></p>  
            </div>
            <br></br>                   
            <input type='submit' value='Lock Ada'/>
        </form>
    )
}

export default LockAda