import { useState } from 'react'

const SubmitTx = ({ onSubmitTx } : any) => {

    const [cborTx, setcborTx] = useState('')

    const onSubmit = (e : any) => {
        
        e.preventDefault() // prevent full page refresh
        onSubmitTx([cborTx])
    }
    

    return (

        <form onSubmit={onSubmit}>
            <div>
                <b>CBOR Transaction</b> 
                <br></br>
                <textarea id='cborTx' rows='35' cols='120' name='cborTx' value={cborTx} onChange={(e) => setcborTx(e.target.value)} >
                </textarea>
                <br/>
                <p></p>                 
            </div>
            <br></br>                   
            <input type='submit' value='Submit Tx'/>
        </form>
    )
}

export default SubmitTx