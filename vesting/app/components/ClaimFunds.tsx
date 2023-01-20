import { useState } from 'react'

const ClaimFunds = ({ onClaimFunds } : any) => {

    const [key, setKey] = useState('');

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onClaimFunds([key])
    }

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Claim Funds</b> 
                <br></br>
                <input name='key' type='text' id='key' placeholder='Enter The Vesting Key' 
                value={key}
                onChange={(e) => setKey(e.target.value)}
                />
                <p></p>  
            </div>
            <br></br>                   
            <input type='submit' value='Claim Funds'/>
        </form>
    )
}

export default ClaimFunds