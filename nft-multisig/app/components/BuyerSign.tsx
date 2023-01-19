import { useState } from 'react'

const buyerSign = ({ onBuyerSign } : any) => {


    const onSubmit = (e : any) => {
        
        e.preventDefault(); // prevent full page refresh
        onBuyerSign();
    }

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>Buyer Sign NFT Transaction</b> 
                <p></p>                 
            </div>
            <br></br>                   
            <input type='submit' value='Buyer Sign'/>
        </form>
    )
}

export default buyerSign