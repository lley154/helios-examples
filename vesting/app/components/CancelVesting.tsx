import { useState } from 'react'

const CancelVesting = ({ onCancelVesting } : any) => {

    const [key, setKey] = useState('');

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onCancelVesting([key])
    }

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Cancel Vesting</b> 
                <br></br>
                <input name='key' type='text' id='key' placeholder='Enter The Vesting Key' 
                value={key}
                onChange={(e) => setKey(e.target.value)}
                />
                <p></p>  
            </div>
            <br></br>                   
            <input type='submit' value='Cancel Vesting'/>
        </form>
    )
}

export default CancelVesting